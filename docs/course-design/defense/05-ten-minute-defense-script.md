# 10-15 分钟答辩讲解脚本

这份文档用于把代码导读压缩成答辩现场能讲的版本。总原则：

- 先演示功能，再把功能背后的数据库设计讲出来。
- 老师追问时，立刻落到“表 + 约束 + 事务 + 代码位置”。
- 不讲非数据库实现细节。

数据库结构统一引用：`packages/db/final-ddl/course-design-final-schema.sql`。

## 0. 开场 30 秒

可以这样说：

> 我的课题是校园生活平台，但本次数据库课程设计只聚焦三个主线模块：平台基础、功能房预约、课程资源分享。平台基础用于用户、组织、RBAC、数据范围和审计；功能房预约用于展示时间资源冲突、事务和并发控制；课程资源分享用于展示审核流、去重、事实表统计和受控冗余。

## 1. 平台基础 2 分钟

讲三点即可：

1. `profiles.id` 一对一扩展 `auth.users.id`。
2. RBAC 用 `user_roles`、`role_permissions` 两张桥接表。
3. 部门树用 `department_closure` 闭包表，审计日志 append-only。

关键口径：

> 用户和角色、角色和权限都是多对多，所以我没有把权限列表存在用户表里，而是用桥接表。部门树除了 `parent_id`，还维护闭包表，用于高效查询本部门及子部门。审计日志采用只追加策略，并用触发器禁止更新删除。

如果老师追问代码：

- RBAC：`packages/db/final-ddl/course-design-final-schema.sql:302-318`
- 闭包表：`packages/db/final-ddl/course-design-final-schema.sql:151-183`、`492-596`
- 审计日志：`packages/db/final-ddl/course-design-final-schema.sql:407-456`
- 审计快照：`packages/db/final-ddl/course-design-final-schema.sql:407-442`

## 2. 功能房预约 5 分钟

这是最重要的一段。

### 2.1 先讲表

> 功能房预约拆成楼房、房间、预约、参与人、封禁。预约主表只存 `room_id`，不重复存楼房名和房间名；参与人是独立联系表，复合主键是 `(reservation_id,user_id)`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:749-959`

### 2.2 再讲时间冲突

> 时间冲突不是只判断开始时间是否相同，而是判断时间区间是否重叠：已有开始小于新结束，并且已有结束大于新开始。服务层事务里先锁房间行并做重叠预查，数据库层用 `EXCLUDE USING gist` 排斥约束最终保证同房间 `pending/approved` 时间段不重叠。

代码位置：

- 重叠预查：`lib/modules/facilities/facilities.service.ts:360-370`
- 行锁：`lib/modules/facilities/facilities.service.ts:346-355`
- 创建预约事务：`lib/modules/facilities/facilities.service.ts:407-445`
- 排斥约束：`packages/db/final-ddl/course-design-final-schema.sql:897-906`

### 2.3 再讲并发

> 如果两个学生同时预约同一房间相交时间段，服务层预查可能有竞态，所以最终不能只靠查询。数据库排斥约束把“不重叠”作为硬约束，至少会拒绝一个冲突写入。

### 2.4 再讲参与人

> 参与人至少 3 人，且申请人必须在参与人表中。这是跨行、跨表规则，普通 `CHECK` 做不了。所以服务层先规范化参与人，数据库用延迟约束触发器在事务提交时统计参与人数、申请人标记数量和申请人匹配关系。

代码位置：

- 服务层规范化：`lib/modules/facilities/facilities.service.ts:335-343`
- 触发器函数：`packages/db/final-ddl/course-design-final-schema.sql:966-1047`
- 延迟触发器：`packages/db/final-ddl/course-design-final-schema.sql:1055-1066`

### 2.5 最后讲状态和封禁

> 预约状态和审核/取消字段用 `CHECK` 保持一致；封禁单独建表，同一用户最多一条未撤销封禁。当前边界是自然过期但未显式撤销仍占用唯一索引，这一点我会主动说明。

代码位置：

- 状态约束：`packages/db/final-ddl/course-design-final-schema.sql:833-895`
- 封禁表：`packages/db/final-ddl/course-design-final-schema.sql:943-959`
- 封禁检查：`lib/modules/facilities/facilities.service.ts:128-139`

## 3. 课程资源分享 4 分钟

### 3.1 先讲主数据和事实表

> 课程资源模块分为专业、课程、专业负责人、资源主体、下载事件、积分事件和最佳推荐。下载事件和积分事件是事实表，不直接混在资源主表里。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1074-1379`

### 3.2 再讲去重

> 文件资源按同课程 `sha256` 去重，外链资源按同课程规范化 URL 去重。唯一索引只对未软删除资源生效。

代码位置：

- 去重索引：`packages/db/final-ddl/course-design-final-schema.sql:1305-1313`
- URL 规范化：`lib/modules/course-resources/courseResources.utils.ts:18-51`

### 3.3 再讲受控冗余

> 资源表同时有 `course_id` 和 `major_id`，从严格 3NF 看有冗余风险，因为课程决定专业。但这是为了按专业过滤、授权和统计保留的受控冗余，数据库用 `(course_id,major_id)` 复合外键保证它必须和课程所属专业一致。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1142-1201`

### 3.4 再讲审核和积分

> 审核通过和写入首次积分事件放在一个事务里，保证资源发布和积分事实原子一致。积分事件用 `(user_id,resource_id,event_type)` 唯一约束避免重复加分。

代码位置：

- 审核事务：`lib/modules/course-resources/courseResources.service.ts:1848-1874`
- 积分唯一约束：`packages/db/final-ddl/course-design-final-schema.sql:1366-1368`

### 3.5 最后讲最佳推荐

> 最佳推荐单独建表，不是资源表的一个布尔字段，因为它还包含推荐人和推荐时间。未发布资源不能设为最佳，这个由服务层检查和数据库触发器共同保证；资源下架时，触发器自动删除最佳记录。

代码位置：

- 设置最佳事务：`lib/modules/course-resources/courseResources.service.ts:2016-2049`
- published-only 触发器：`packages/db/final-ddl/course-design-final-schema.sql:1388-1421`
- 下架删除最佳触发器：`packages/db/final-ddl/course-design-final-schema.sql:1423-1443`

## 4. 老师追问时的转场句

### 问：这个功能怎么防止非法数据？

回答模板：

> 我这里分两层。服务层先做前置校验，给用户友好错误；数据库层有硬约束兜底。比如……对应约束在……即使绕过服务层直接写库，也会失败。

### 问：这个表符合第几范式？

回答模板：

> 主体上满足 3NF，因为非主属性直接依赖主键，没有把可由外键关联得到的名称字段重复进来。这里有一个需要解释的受控冗余是……它的目的不是偷懒，而是……一致性由……保证。

### 问：这个事务会不会并发冲突？

回答模板：

> 如果只做“先查再插”，确实可能有并发竞态。所以我这里服务层用了事务和锁做前置控制，数据库层用……约束表达最终不变量。并发情况下最终由数据库拒绝冲突写入。

### 问：为什么不用普通 `CHECK`？

回答模板：

> 普通 `CHECK` 只能检查当前行。这个规则涉及多行统计或跨表状态，比如……所以用触发器/复合外键来表达。

## 5. 最推荐演示的 3 个失败样例

1. 同房间相交时间段预约失败。
   - `packages/db/final-ddl/course-design-final-schema.sql:897-906`
2. 预约参与人不足或申请人不匹配失败。
   - `packages/db/final-ddl/course-design-final-schema.sql:966-1066`
3. 课程资源 `course_id/major_id` 不一致失败。
   - `packages/db/final-ddl/course-design-final-schema.sql:1195-1201`

这些样例能证明你的数据库不只是存数据，而是在主动维护业务不变量。
