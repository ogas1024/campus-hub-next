# 数据库课程设计答辩模拟问答（具体实现版）

说明：这版不按“数据库知识点”笼统出题，而按老师更可能的追问方式组织：针对某个需求、某个功能、某个非法行为、某个并发场景，回答你在本项目里具体用了哪些表、约束、事务、索引、触发器和代码位置。

重要：答辩时查“最终数据库结构”，统一看 `packages/db/final-ddl/course-design-final-schema.sql`。本问答里如果出现 `packages/db/migrations/*.sql`，表示这个设计最初在哪个历史迁移里补强；最终表结构、最终约束和触发器已经收敛到 final DDL。

答辩时不要背成“我用了很多约束”。更好的说法是：“针对这个需求，我的表结构是……数据库约束在……服务层事务在……如果绕过服务层，数据库仍会由……拒绝。”

## 一、功能房预约：重点准备

### Q1：针对“用户可以预约功能房”这个需求，你数据库层是怎么建模的？
**标签：** `模块：功能房预约` `知识点：ER 设计 / 主从关系 / 外键`

**参考答案：** 我把功能房预约拆成楼房、房间、预约、预约参与人、封禁五类事实。楼房和房间是空间主数据，预约是事务主表，参与人是预约和用户的多对多联系表，封禁是模块治理记录。预约表只保存 `room_id`、`applicant_id`、时间段和状态，不重复保存楼房名、房间名，避免更新异常。

**实现位置：** `packages/db/migrations/0006_facility_reservations.sql:35-143` 定义房间、预约、参与人、封禁表；`lib/modules/facilities/facilities.service.ts:382-445` 是创建预约的事务写入流程。

### Q2：针对“同一楼同一层不能出现两个同名房间”，你怎么防止重复数据？
**标签：** `模块：功能房预约` `知识点：候选键 / 部分唯一索引 / 软删除`

**参考答案：** 房间名不是全局唯一，因为不同楼或不同楼层都可能有 101。我的业务唯一性是 `(building_id, floor_no, name)`，并且只对未软删除记录生效。这样既保证当前有效房间不重复，又允许保留历史删除记录。

**实现位置：** `packages/db/migrations/0006_facility_reservations.sql:50-52` 的 `facility_rooms_name_active_uq`；房间表外键和容量检查在 `0006_facility_reservations.sql:35-48`。

### Q3：针对“预约时间必须合法”，你做了几层校验？
**标签：** `模块：功能房预约` `知识点：CHECK / 服务层前置校验 / 用户定义完整性`

**参考答案：** 服务层先做友好校验：开始时间要晚于当前时间，结束时间要晚于开始时间，且不超过最大预约时长。数据库层再用 `CHECK(end_at > start_at)` 做最终兜底。答辩时重点强调数据库层不是依赖输入流程，而是自己能拒绝结束早于开始的非法记录。

**实现位置：** 服务层 `assertStartEnd()` 在 `lib/modules/facilities/facilities.service.ts:373-380`；数据库约束 `facility_reservations_time_chk` 在 `packages/db/migrations/0006_facility_reservations.sql:88`；错误翻译在 `facilities.service.ts:42-45`。

### Q4：针对“同一房间同一时间不能被重复预约”，你怎么设计？
**标签：** `模块：功能房预约` `知识点：时间区间 / 排斥约束 / 并发控制`

**参考答案：** 我不是只查有没有相同开始时间，而是按时间区间重叠判断。服务层在事务内先查 `start_at < new_end and end_at > new_start`，数据库层再用 PostgreSQL 的 `EXCLUDE USING gist` 排斥约束，限制同一 `room_id` 下 `pending/approved` 的 `tstzrange(start_at,end_at,'[)')` 不重叠。

**实现位置：** 服务层重叠查询在 `lib/modules/facilities/facilities.service.ts:360-370`；排斥约束在 `packages/db/migrations/0012_course_design_constraints.sql:8-18`；友好错误翻译在 `facilities.service.ts:33-36`。

### Q5：如果两个学生同时提交同一房间相交时间段预约，会不会都成功？
**标签：** `模块：功能房预约` `知识点：事务并发 / 竞态条件 / 数据库硬约束`

**参考答案：** 不会。创建预约时先在事务内锁定房间行，再做时间冲突预查，最后插入预约和参与人。即使两个事务都在前置查询阶段认为可预约，提交写入时数据库的 `facility_reservations_room_active_time_excl` 排斥约束仍会拒绝其中一个冲突写入。

**实现位置：** 房间行锁 `FOR UPDATE` 在 `lib/modules/facilities/facilities.service.ts:346-355`；创建预约事务在 `facilities.service.ts:407-445`；数据库排斥约束在 `packages/db/migrations/0012_course_design_constraints.sql:8-18`。

### Q6：为什么冲突判断只针对 `pending` 和 `approved`，不包含 `rejected` 和 `cancelled`？
**标签：** `模块：功能房预约` `知识点：状态语义 / 部分索引 / 排斥约束`

**参考答案：** `pending` 表示待审核但已经预占资源，`approved` 表示正式占用资源，所以都要参与冲突判断。`rejected` 和 `cancelled` 不再占用房间，如果它们继续参与冲突，会导致历史记录阻止新的合法预约。

**实现位置：** 服务层查询条件在 `lib/modules/facilities/facilities.service.ts:361-365`；活跃预约部分索引在 `packages/db/migrations/0006_facility_reservations.sql:102-105`；排斥约束条件在 `packages/db/migrations/0012_course_design_constraints.sql:15`。

### Q7：为什么时间区间用 `[)` 半开区间？
**标签：** `模块：功能房预约` `知识点：时间区间 / 边界条件`

**参考答案：** `[)` 表示包含开始时间、不包含结束时间。这样 10:00-11:00 和 11:00-12:00 可以连续预约，不会被误判为重叠；但 10:30-11:30 会和 10:00-11:00 冲突。

**实现位置：** `tstzrange(start_at, end_at, '[)')` 在 `packages/db/migrations/0012_course_design_constraints.sql:13`。

### Q8：针对“预约至少 3 名使用人，且申请人必须在使用人里”，你怎么防止非法数据？
**标签：** `模块：功能房预约` `知识点：跨行约束 / 延迟约束触发器`

**参考答案：** 服务层先把申请人自动加入参与人集合，并去重，少于 3 人直接拒绝。数据库层用延迟约束触发器在事务提交时统计参与人数量、申请人标记数量，以及 `is_applicant=true` 的用户是否等于预约主表的 `applicant_id`。这类规则跨多行、跨表，普通 `CHECK` 做不了。

**实现位置：** 服务层参与人规范化在 `lib/modules/facilities/facilities.service.ts:335-343`；数据库触发器函数在 `packages/db/migrations/0012_course_design_constraints.sql:20-90`；延迟约束触发器在 `0012_course_design_constraints.sql:92-108`。

### Q9：如果有人直接往参与人表里插两个 `is_applicant=true`，会怎样？
**标签：** `模块：功能房预约` `知识点：部分唯一索引 / 非法行为防护`

**参考答案：** 数据库会拒绝。`facility_reservation_participants_applicant_uq` 是部分唯一索引，只对 `is_applicant=true` 的行生效，保证每条预约最多一个申请人参与记录。另外延迟触发器还要求最终恰好一个申请人，且必须匹配主表 `applicant_id`。

**实现位置：** 部分唯一索引在 `packages/db/migrations/0006_facility_reservations.sql:121-124`；触发器检查申请人数量和匹配关系在 `packages/db/migrations/0012_course_design_constraints.sql:74-85`。

### Q10：为什么预约参与人数下限不用普通 `CHECK`？
**标签：** `模块：功能房预约` `知识点：CHECK 局限 / 跨行聚合约束`

**参考答案：** 普通 `CHECK` 只能检查当前行，不能统计同一预约下面有多少参与人。参与人数下限是跨行聚合约束，所以用延迟约束触发器，在事务提交时统一检查最终状态。

**实现位置：** 统计 `count(*)` 的逻辑在 `packages/db/migrations/0012_course_design_constraints.sql:59-65`；少于 3 人抛出 `facility_reservation_participants_min_count_chk` 在 `0012_course_design_constraints.sql:67-72`。

### Q11：为什么要用“延迟”约束触发器，而不是普通立即触发器？
**标签：** `模块：功能房预约` `知识点：事务内部临时不一致 / DEFERRABLE`

**参考答案：** 创建预约时先插入预约主记录，再批量插入参与人。事务中间状态可能暂时没有 3 个参与人，如果立即触发会误杀正常写入。延迟约束触发器允许事务内部临时不一致，但提交时必须满足最终一致性。

**实现位置：** 创建预约先插 `facility_reservations` 再插 `facility_reservation_participants`，见 `lib/modules/facilities/facilities.service.ts:414-442`；触发器声明 `deferrable initially deferred` 在 `packages/db/migrations/0012_course_design_constraints.sql:93-105`。

### Q12：针对“被封禁用户不能提交预约”，你怎么实现？数据库层有什么边界？
**标签：** `模块：功能房预约` `知识点：封禁表 / 部分唯一索引 / 边界说明`

**参考答案：** 封禁独立建 `facility_bans`，创建预约前查询该用户是否有 `revoked_at is null` 的封禁；如果 `expires_at` 已过期，服务层允许继续。数据库层用部分唯一索引保证同一用户同时最多一条未撤销封禁。边界是：自然过期但未显式撤销的记录仍占用这个唯一索引位置。

**实现位置：** 封禁表和唯一索引在 `packages/db/migrations/0006_facility_reservations.sql:126-143`；创建预约前检查在 `lib/modules/facilities/facilities.service.ts:128-139` 和 `facilities.service.ts:399`；边界来自 `facility_bans_user_active_uq` 只看 `revoked_at is null`。

### Q13：针对“管理员重新封禁一个已经封禁的用户”，你如何避免多条有效封禁冲突？
**标签：** `模块：功能房预约` `知识点：事务 / 部分唯一索引`

**参考答案：** 服务层把“撤销旧封禁”和“插入新封禁”放在同一个事务里，先把该用户所有未撤销封禁设置 `revoked_at`，再插入新的封禁记录。数据库层还有 `facility_bans_user_active_uq` 兜底，保证同一用户最多一条未撤销封禁。

**实现位置：** 封禁替换事务在 `lib/modules/facilities/facilities.service.ts:1396-1407`；部分唯一索引在 `packages/db/migrations/0006_facility_reservations.sql:143`。

### Q14：预约状态和审核字段如何保持一致？比如 `approved` 没有审核时间怎么办？
**标签：** `模块：功能房预约` `知识点：状态机 / CHECK 约束`

**参考答案：** 数据库用 `facility_reservations_status_consistency_chk` 约束状态和字段组合。`pending` 不能有审核/取消字段；`approved` 必须有 `reviewed_by/reviewed_at`；`rejected` 必须有审核人、审核时间和驳回原因；`cancelled` 必须有取消人和取消时间。

**实现位置：** 状态一致性约束在 `packages/db/migrations/0014_facility_reservation_status_consistency.sql:35-78`；审核通过写入审核人和审核时间在 `lib/modules/facilities/facilities.service.ts:1242-1246`；驳回写入原因在 `facilities.service.ts:1291-1295`。

### Q15：为什么取消预约时允许保留审核痕迹？
**标签：** `模块：功能房预约` `知识点：历史语义 / 状态约束边界`

**参考答案：** 因为一条预约可能先被审核通过，之后用户又取消。此时取消状态需要有取消人和取消时间，但原审核人和审核时间可以保留，用来表达历史过程。约束中允许 `cancelled` 状态下审核字段要么成对为空，要么成对存在。

**实现位置：** `cancelled` 分支在 `packages/db/migrations/0014_facility_reservation_status_consistency.sql:67-77`；用户取消写入 `cancelled_at/cancelled_by/cancel_reason` 在 `lib/modules/facilities/facilities.service.ts:585-604`。

### Q16：被驳回的预约重新提交，为什么必须用事务？
**标签：** `模块：功能房预约` `知识点：事务原子性 / 主表明细表一致`

**参考答案：** 重新提交要同时修改预约主表的时间、状态、审核字段，并删除旧参与人、插入新参与人。如果不在事务中，可能出现主表已改但参与人没改，或参与人改了主表失败。当前用事务保证整体提交或整体回滚。

**实现位置：** 只允许 `rejected` 修改在 `lib/modules/facilities/facilities.service.ts:500-518`；更新主表和重写参与人在 `facilities.service.ts:521-547`。

### Q17：预约审核通过时，会不会重新检查时间冲突？
**标签：** `模块：功能房预约` `知识点：状态流转 / 排斥约束`

**参考答案：** 审核通过只允许 `pending -> approved`。因为 `pending` 本来就已经参与排斥约束，所以从 `pending` 改成 `approved` 不会新增一个未检查的占用区间。数据库排斥约束覆盖 `pending/approved`，能保证审核前后都不重叠。

**实现位置：** 审核通过条件 `status='pending'` 在 `lib/modules/facilities/facilities.service.ts:1242-1246`；排斥约束包含 `pending/approved` 在 `packages/db/migrations/0012_course_design_constraints.sql:15`。

### Q18：功能房预约表符合第几范式？参与人表呢？
**标签：** `模块：功能房预约` `知识点：3NF / BCNF`

**参考答案：** `facility_reservations` 主体上满足 3NF：预约状态、时间、申请人、审核字段都直接描述该预约事实，没有把房间名称、楼房名称等传递依赖字段放进来。`facility_reservation_participants` 是预约和用户的联系表，复合主键是 `(reservation_id,user_id)`，`is_applicant` 描述这条联系，整体接近 BCNF。

**实现位置：** 预约表在 `packages/db/migrations/0006_facility_reservations.sql:65-95`；参与人表在 `0006_facility_reservations.sql:112-124`。

### Q19：功能房时间线查询为什么需要 `(room_id,start_at,end_at)` 这样的索引？
**标签：** `模块：功能房预约` `知识点：索引设计 / 时间窗口查询`

**参考答案：** 房间时间线和冲突检测都先限定 `room_id`，再比较时间窗口，所以联合索引按房间和时间字段组织。活跃预约还单独建部分索引，只索引 `pending/approved`，减少历史驳回、取消记录对高频查询的影响。

**实现位置：** 时间线查询条件在 `lib/modules/facilities/facilities.service.ts:360-370`；普通联合索引和活跃部分索引在 `packages/db/migrations/0006_facility_reservations.sql:100-105`。

### Q20：功能房排行榜为什么统计使用秒数，而不是预约条数？
**标签：** `模块：功能房预约` `知识点：统计语义 / 聚合查询`

**参考答案：** 预约次数不能反映真实使用量，一个 30 分钟预约和一个 4 小时预约不能同权。排行榜应统计在给定窗口内与预约时间重叠的实际秒数，这样更符合空间资源使用率的定义。

**实现位置：** 时间重叠秒数函数在 `lib/modules/facilities/facilities.utils.ts:55-60`；排行榜相关查询函数在 `lib/modules/facilities/facilities.service.ts:1461` 和 `facilities.service.ts:1503` 起。

## 二、课程资源分享：受控冗余、审核、积分

### Q21：针对“按专业和课程分享资源”，你怎么建模？
**标签：** `模块：课程资源分享` `知识点：ER 设计 / 一对多 / 多对多`

**参考答案：** 教学主数据分为 `majors` 和 `courses`，课程通过 `major_id` 属于专业。专业负责人是多对多关系，用 `major_leads(major_id,user_id)`。资源主体在 `course_resources`，引用课程、专业和创建者。下载、积分和最佳推荐不混入主表，而是拆成事实表或派生事实表。

**实现位置：** 专业、负责人、课程、资源表在 `packages/db/migrations/0004_course_resources.sql:27-205`；资源详情和列表查询主要在 `lib/modules/course-resources/courseResources.service.ts`。

### Q22：专业负责人为什么不用 `majors.leader_id` 一个字段？
**标签：** `模块：课程资源分享` `知识点：多对多 / 1NF / 2NF`

**参考答案：** 一个专业可以有多个负责人，一个用户也可以负责多个专业，这是多对多联系。用 `major_leads` 桥接表可以避免负责人列表字段，并用复合主键 `(major_id,user_id)` 防止重复负责人关系。

**实现位置：** `major_leads` 表在 `packages/db/migrations/0004_course_resources.sql:47-55`。

### Q23：课程名为什么是专业内唯一，而不是全局唯一？
**标签：** `模块：课程资源分享` `知识点：候选键 / 业务唯一性`

**参考答案：** 不同专业都可能有“数据库系统概论”“高等数学”等同名课程，所以全局唯一不合理。候选键应按业务识别范围设计，本项目用 `(major_id,name)` 在未软删除记录中唯一。

**实现位置：** `courses_major_name_active_uq` 在 `packages/db/migrations/0004_course_resources.sql:71`。

### Q24：文件资源和外链资源字段很多，你怎么保证不会混填？
**标签：** `模块：课程资源分享` `知识点：CHECK / 域完整性`

**参考答案：** `course_resources` 用 `resource_type` 区分 `file` 和 `link`，数据库 `CHECK` 约束要求文件型资源只能有文件字段，外链型资源只能有链接字段。草稿态允许暂时缺少具体文件或链接，因为文件型资源有“先建草稿、再上传回填”的过程。

**实现位置：** 最终版本的 `course_resources_file_or_link_chk` 在 `packages/db/migrations/0005_course_resources_constraints.sql:10-56`；写入失败翻译在 `lib/modules/course-resources/courseResources.service.ts:74-80`。

### Q25：为什么文件资源草稿态允许没有 `sha256`，但提交审核前不允许？
**标签：** `模块：课程资源分享` `知识点：状态约束 / 提交流程`

**参考答案：** 文件资源创建时可能先生成草稿，文件上传完成后才回填 `file_bucket/file_key/file_name/file_size/sha256`。所以草稿态可以暂缺这些字段；但提交审核前必须检查文件元信息完整，并做同课程 `sha256` 重复检查。

**实现位置：** 草稿态例外在 `packages/db/migrations/0005_course_resources_constraints.sql:17-32`；提交前检查 `assertReadyForSubmit()` 在 `lib/modules/course-resources/courseResources.service.ts:993-1012`；提交审核状态更新在 `courseResources.service.ts:1038-1065`。

### Q26：同一课程下重复上传同一个文件，你怎么防止？
**标签：** `模块：课程资源分享` `知识点：唯一索引 / 内容哈希去重`

**参考答案：** 文件资源用 `sha256` 表示文件内容摘要。同一课程下 `course_id + sha256` 对未删除文件资源唯一，数据库直接拒绝重复内容。服务层提交前也做预查，用来给出更友好的错误。

**实现位置：** 唯一索引 `course_resources_course_sha256_active_uq` 在 `packages/db/migrations/0004_course_resources.sql:153-156`；服务层预查在 `lib/modules/course-resources/courseResources.service.ts:998-1011`；数据库错误翻译在 `courseResources.service.ts:50-56`。

### Q27：外链资源为什么要保存 `link_url_normalized`？
**标签：** `模块：课程资源分享` `知识点：规范化 URL / 去重`

**参考答案：** 原始 URL 可能因为协议省略、大小写、尾部斜杠、参数顺序不同而表示同一资源。`link_url_normalized` 用于统一格式，再通过 `(course_id,link_url_normalized)` 做去重，比直接比较原始输入更稳定。

**实现位置：** URL 规范化函数在 `lib/modules/course-resources/courseResources.utils.ts:18-51`；外链唯一索引在 `packages/db/migrations/0004_course_resources.sql:158-160`。

### Q28：`course_resources` 同时存 `course_id` 和 `major_id`，是不是违反 3NF？
**标签：** `模块：课程资源分享` `知识点：3NF / 受控冗余 / 复合外键`

**参考答案：** 严格看，课程决定专业，存在 `course_id -> major_id`，所以资源表保留 `major_id` 有冗余风险。我会主动承认这是受控冗余，目的是按专业过滤、授权和统计更高效。关键是数据库用 `(course_id,major_id)` 复合外键引用 `courses(id,major_id)`，锁定专业与课程一致。

**实现位置：** 课程和资源的复合唯一/外键在 `packages/db/migrations/0012_course_design_constraints.sql:124-147`；服务层更新课程时把 `majorId` 修正为课程所属专业，见 `lib/modules/course-resources/courseResources.service.ts:920-924`；不一致错误翻译在 `courseResources.service.ts:59-62`。

### Q29：如果有人手工把资源的 `course_id` 指向 A 专业课程，但 `major_id` 写成 B 专业，会怎样？
**标签：** `模块：课程资源分享` `知识点：复合外键 / 非法行为防护`

**参考答案：** 数据库会拒绝。因为 `course_resources(course_id,major_id)` 必须匹配 `courses(id,major_id)` 中真实存在的一组值，A 专业课程和 B 专业 ID 不能组成合法外键。

**实现位置：** `course_resources_course_major_fk` 在 `packages/db/migrations/0012_course_design_constraints.sql:138-147`；错误翻译为“课程与专业必须保持一致”在 `lib/modules/course-resources/courseResources.service.ts:59-62`。

### Q30：资源状态和提交、审核、发布时间如何保持一致？
**标签：** `模块：课程资源分享` `知识点：状态机 / CHECK 约束`

**参考答案：** 数据库用 `course_resources_status_consistency_chk` 限制状态和时间字段组合。`draft` 不能有提交/审核/发布时间；`pending` 必须有提交时间且无审核时间；`published` 必须有审核和发布时间；`unpublished` 必须有发布和下架时间。

**实现位置：** 状态一致性约束在 `packages/db/migrations/0012_course_design_constraints.sql:170-219`；提交审核设置 `pending/submitted_at` 在 `lib/modules/course-resources/courseResources.service.ts:1046-1065`；审核通过设置 `published/reviewed_at/published_at` 在 `courseResources.service.ts:1848-1861`。

### Q31：审核通过和积分写入为什么必须在同一个事务里？
**标签：** `模块：课程资源分享` `知识点：事务原子性 / 事实表`

**参考答案：** 审核通过和首次积分是同一个业务原子单元。如果资源发布成功但积分事件没写，或者积分写了但资源仍未发布，都会造成业务不一致。所以事务内先更新资源为 `published`，再插入 `approve` 积分事件。

**实现位置：** 审核通过事务在 `lib/modules/course-resources/courseResources.service.ts:1848-1874`；积分表和唯一约束在 `packages/db/migrations/0004_course_resources.sql:189-199`。

### Q32：如果审核通过操作被重复执行，会不会重复加分？
**标签：** `模块：课程资源分享` `知识点：幂等 / 唯一约束`

**参考答案：** 不会。服务层只允许 `pending` 状态资源审核通过；积分表还有 `(user_id,resource_id,event_type)` 唯一约束，写入时使用 `onConflictDoNothing()`，重复请求不会产生第二条同类积分事件。

**实现位置：** 审核只更新 `status='pending'` 的资源在 `lib/modules/course-resources/courseResources.service.ts:1848-1863`；积分写入 `onConflictDoNothing()` 在 `courseResources.service.ts:1865-1874`；唯一约束在 `packages/db/migrations/0004_course_resources.sql:198-199`。

### Q33：积分事件中的 `user_id` 为什么也算受控冗余？
**标签：** `模块：课程资源分享` `知识点：受控冗余 / 作者归属复合外键`

**参考答案：** 积分奖励给资源作者，而作者可以由 `resource_id -> course_resources.created_by` 推导，所以 `score_events.user_id` 是为了排行榜聚合保留的受控冗余。数据库用 `(resource_id,user_id)` 外键引用 `course_resources(id,created_by)`，保证积分用户就是资源作者。

**实现位置：** 作者归属复合外键在 `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:13-29`；错误翻译在 `lib/modules/course-resources/courseResources.service.ts:63-68`。

### Q34：积分事件中的 `major_id` 如何保证和资源专业一致？
**标签：** `模块：课程资源分享` `知识点：复合外键 / 统计维度一致性`

**参考答案：** `score_events.major_id` 用于按专业统计积分榜，但它可以从资源推导，所以必须受控。数据库用 `(resource_id,major_id)` 引用 `course_resources(id,major_id)`，保证积分事件的专业维度和资源主体一致。

**实现位置：** `course_resource_score_events_resource_major_fk` 在 `packages/db/migrations/0012_course_design_constraints.sql:149-158`；服务层积分榜按 `major_id` 聚合过滤在 `lib/modules/course-resources/courseResources.service.ts:583-594`。

### Q35：为什么“最佳推荐”要单独建表，而不是 `course_resources.is_best`？
**标签：** `模块：课程资源分享` `知识点：事实建模 / 一对一派生事实`

**参考答案：** 最佳推荐不只是布尔状态，还包含推荐人和推荐时间。单独建 `course_resource_bests(resource_id,best_by,best_at)` 可以表达“某资源被推荐”这一事实，`resource_id` 主键保证每个资源最多一条最佳推荐。

**实现位置：** `course_resource_bests` 在 `packages/db/migrations/0004_course_resources.sql:167-174`；设置最佳事务在 `lib/modules/course-resources/courseResources.service.ts:2016-2049`。

### Q36：未发布资源能不能被设为最佳？你怎么保证？
**标签：** `模块：课程资源分享` `知识点：触发器 / 跨表状态约束`

**参考答案：** 不能。服务层先检查资源必须是 `published`，数据库层还有触发器 `course_resource_best_requires_published()`，插入或更新 `course_resource_bests` 时查询资源状态，不是发布态就抛出约束错误。因为这是跨表状态规则，普通 `CHECK` 做不了。

**实现位置：** 服务层检查在 `lib/modules/course-resources/courseResources.service.ts:2020-2023`；数据库触发器函数在 `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:37-68`。

### Q37：如果一个最佳资源被下架，最佳记录会不会残留？
**标签：** `模块：课程资源分享` `知识点：触发器 / 派生状态维护`

**参考答案：** 不会。资源状态离开 `published` 时，数据库触发器会自动删除对应 `course_resource_bests` 记录，避免出现“未发布资源仍是最佳”的矛盾状态。

**实现位置：** `course_resource_drop_best_when_not_published()` 在 `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:73-95`；下架资源更新 `unpublished_at` 在 `lib/modules/course-resources/courseResources.service.ts:1971-1979`。

### Q38：下载资源时，你为什么既写下载事件，又更新下载计数？
**标签：** `模块：课程资源分享` `知识点：事实表 / 汇总冗余 / 事务`

**参考答案：** 下载事件是明细事实，用于审计和时间窗口统计；`download_count` 是汇总冗余，用于列表排序和快速展示。两者放在同一事务中，保证下载事实和计数字段一致更新。

**实现位置：** 下载事务写事件并递增计数在 `lib/modules/course-resources/courseResources.service.ts:396-408`；下载事件表在 `packages/db/migrations/0004_course_resources.sql:176-187`；`download_count` 字段和非负约束在 `0004_course_resources.sql:110-121`。

### Q39：课程资源模块哪些表基本满足 3NF，哪张表需要解释？
**标签：** `模块：课程资源分享` `知识点：3NF / 受控冗余`

**参考答案：** `majors`、`courses`、`major_leads`、`course_resource_download_events` 等结构比较清晰，主体上满足 3NF。需要重点解释的是 `course_resources` 和 `course_resource_score_events`：它们保留了可推导的 `major_id/user_id`，属于为范围过滤和统计服务的受控冗余，并用复合外键保证一致性。

**实现位置：** 主数据和事实表在 `packages/db/migrations/0004_course_resources.sql:27-205`；资源专业复合外键在 `0012_course_design_constraints.sql:138-158`；积分作者复合外键在 `0013_course_resource_author_and_best_constraints.sql:20-26`。

### Q40：课程资源审核流中，哪些非法状态转换会被拒绝？
**标签：** `模块：课程资源分享` `知识点：状态机 / 非法行为防护`

**参考答案：** 作者只能把 `draft/rejected/unpublished` 提交为 `pending`；只有 `pending` 可以被审核通过或驳回；只有 `published` 可以设为最佳。数据库还会检查状态和时间字段组合，防止手工构造“状态是 published 但没有 published_at”这类非法记录。

**实现位置：** 作者修改状态限制在 `lib/modules/course-resources/courseResources.service.ts:879-880`；提交审核限制在 `courseResources.service.ts:1038-1065`；审核通过限制在 `courseResources.service.ts:1800-1803` 和 `1848-1863`；状态一致性约束在 `packages/db/migrations/0012_course_design_constraints.sql:173-219`。

## 三、平台基础：组织、权限、数据范围、审计

### Q41：针对“注册用户要自动生成业务资料和默认角色”，你怎么设计？
**标签：** `模块：平台基础` `知识点：一对一扩展 / 触发器 / 默认角色`

**参考答案：** `auth.users` 是认证身份事实源，`profiles.id` 用同一个 UUID 作为主键并引用用户身份，实现一对一扩展。新用户插入后，触发器读取元数据生成 `profiles`，并给用户插入默认 `user` 角色。

**实现位置：** `profiles.id` 外键和学号约束在 `packages/db/migrations/0001_baseline.sql:76-92`；新版 `handle_new_user()` 在 `packages/db/migrations/0018_profiles_auth_snapshot.sql:28-85`；默认角色写入在 `0018_profiles_auth_snapshot.sql:77-81`。

### Q42：学号重复或格式不对，怎么防止？
**标签：** `模块：平台基础` `知识点：候选键 / CHECK / 唯一约束`

**参考答案：** `student_id` 是业务候选键之一，用唯一索引防止重复；同时用正则 `CHECK` 限定为 16 位数字，防止非法格式。这样不是只靠输入规则，而是数据库自己能拒绝错误学号。

**实现位置：** `profiles_student_id_format_chk` 和 `profiles_student_id_uq` 在 `packages/db/migrations/0001_baseline.sql:88-92`。

### Q43：针对“用户可以有多个角色，角色有多个权限”，你怎么建模？
**标签：** `模块：平台基础` `知识点：RBAC / 多对多 / 复合主键`

**参考答案：** 用户和角色是多对多，用 `user_roles(user_id,role_id)`；角色和权限也是多对多，用 `role_permissions(role_id,permission_id)`。两个桥接表都用复合主键，既表达联系事实，也防止重复授权。

**实现位置：** `user_roles` 和 `role_permissions` 在 `packages/db/migrations/0001_baseline.sql:106-124`；角色权限整体替换事务在 `lib/modules/rbac/rbac.service.ts:247-254`。

### Q44：`user_roles` 符合第几范式？如果加 `role_name` 会怎样？
**标签：** `模块：平台基础` `知识点：2NF / 3NF / 反例`

**参考答案：** `user_roles` 以 `(user_id,role_id)` 为复合主键，非主属性 `created_at` 描述这条授权联系，满足 2NF，整体接近 BCNF。如果加入 `role_name`，它只依赖 `role_id`，会产生部分依赖和冗余，应该留在 `roles` 表。

**实现位置：** `user_roles` 表在 `packages/db/migrations/0001_baseline.sql:106-114`。

### Q45：针对“某角色在某模块只能配置合法数据范围”，你怎么防止乱填模块名？
**标签：** `模块：平台基础` `知识点：域约束 / 模块字典 / 外键`

**参考答案：** 我不是把 `module` 当自由文本。先用 `app_modules` 维护系统模块字典，再用 `data_scope_modules` 表示支持数据权限的模块集合，最后让 `role_data_scopes.module` 外键引用 `data_scope_modules.module_code`。这样只有被声明为支持数据范围的模块才能配置。

**实现位置：** `app_modules` 和 `data_scope_modules` 在 `packages/db/migrations/0015_module_dictionary_and_data_scope_fks.sql:7-32`；能力数据初始化在 `0015_module_dictionary_and_data_scope_fks.sql:54-62`；`role_data_scopes_module_fk` 在 `0015_module_dictionary_and_data_scope_fks.sql:85-93`。

### Q46：针对“自定义数据范围要选多个部门”，你怎么保证明细不能脱离主配置？
**标签：** `模块：平台基础` `知识点：复合外键 / 父子表一致性`

**参考答案：** `role_data_scopes(role_id,module)` 是主配置，`role_data_scope_departments(role_id,module,department_id)` 是自定义部门明细。明细表用复合外键引用主配置，防止出现“有部门明细但没有对应角色模块范围”的脏数据。

**实现位置：** 复合外键在 `packages/db/migrations/0002_infra.sql:259-267`；服务层整体替换事务先删明细再删主表、再插新配置，见 `lib/modules/data-permission/dataPermission.service.ts:203-225`；外键错误翻译在 `dataPermission.service.ts:40-46`。

### Q47：角色数据范围整体替换为什么必须用事务？
**标签：** `模块：平台基础` `知识点：事务 / 父子表一致性`

**参考答案：** 修改一个角色的数据范围涉及删除旧明细、删除旧主配置、插入新主配置、插入新部门明细。如果中途失败，不能留下半新半旧的配置。因此必须事务化。

**实现位置：** `db.transaction` 在 `lib/modules/data-permission/dataPermission.service.ts:203-225`；复合外键兜底在 `packages/db/migrations/0002_infra.sql:265-266`。

### Q48：部门树为什么不用单纯递归查 `parent_id`，还要闭包表？
**标签：** `模块：平台基础` `知识点：层级结构 / 闭包表 / 查询优化`

**参考答案：** `parent_id` 适合表达直接上下级，但“某部门及全部子部门”是数据范围过滤高频查询。闭包表 `department_closure` 预存祖先-后代关系，可以直接按 `ancestor_id` 查所有后代，避免每次递归展开。

**实现位置：** 闭包表在 `packages/db/migrations/0002_infra.sql:65-75`；初始化递归构造在 `0002_infra.sql:80-90`。

### Q49：部门树如何防止形成环？
**标签：** `模块：平台基础` `知识点：触发器 / 树结构完整性`

**参考答案：** 更新 `parent_id` 前，触发器检查新父节点是否是当前部门自己的后代。如果是，就说明移动后会形成环，数据库直接拒绝。也禁止 `parent_id = id`。

**实现位置：** `departments_assert_no_cycle()` 在 `packages/db/migrations/0002_infra.sql:92-119`；触发器绑定在 `0002_infra.sql:121-125`。

### Q50：审计日志为什么不允许更新和删除？
**标签：** `模块：平台基础` `知识点：审计表 / append-only / 触发器`

**参考答案：** 审计日志记录“谁在什么时候对什么对象做了什么”，核心价值是可追溯。如果允许更新或删除，就会破坏历史真实性。因此数据库触发器禁止 `UPDATE/DELETE`，使审计表只追加。

**实现位置：** `audit_logs` 表和索引在 `packages/db/migrations/0002_infra.sql:273-295`；阻止更新删除的函数和触发器在 `0002_infra.sql:297-320`。

### Q51：审计日志为什么故意不对 `actor_user_id` 建物理外键？
**标签：** `模块：平台基础` `知识点：弱引用 / 历史快照 / 设计取舍`

**参考答案：** 审计日志优先保留历史事实。如果操作者账号后续被删除、脱敏或资料变化，强外键可能影响审计记录保留。当前用弱引用加 `actor_name/actor_email/actor_roles` 快照保存事件发生时的可读身份语义。

**实现位置：** 弱引用和注释说明在 `packages/db/migrations/0016_audit_actor_snapshot_strategy.sql:28-44`；写审计时抓取角色和姓名快照在 `lib/modules/audit/audit.service.ts:27-55`。

### Q52：审计快照中的 `actor_roles` 怎么防止结构乱写？
**标签：** `模块：平台基础` `知识点：JSON 检查 / 用户定义完整性`

**参考答案：** 虽然 `actor_roles` 是 JSON，但数据库仍做最低结构检查：必须是对象；如果包含 `roleCodes`，它必须是数组。这样避免不可解释的 JSON 进入审计表。

**实现位置：** `audit_logs_actor_roles_object_chk` 在 `packages/db/migrations/0016_audit_actor_snapshot_strategy.sql:18-26`；写入 `{ roleCodes: actorRoleCodes }` 在 `lib/modules/audit/audit.service.ts:42-55`。

## 四、老师追问“非法行为/并发/范式”时的短答模板

### Q53：如果用户绕过正常流程，直接插入非法预约时间，谁兜底？
**标签：** `模块：功能房预约` `知识点：数据库硬约束`

**参考答案：** 数据库兜底。`end_at <= start_at` 被 `facility_reservations_time_chk` 拒绝；同房间活跃预约重叠被 `facility_reservations_room_active_time_excl` 拒绝；参与人不足或申请人不一致被延迟约束触发器拒绝。

**实现位置：** `packages/db/migrations/0006_facility_reservations.sql:88`；`packages/db/migrations/0012_course_design_constraints.sql:8-18`；`0012_course_design_constraints.sql:20-108`。

### Q54：如果用户绕过正常流程，直接把未发布资源设为最佳，谁兜底？
**标签：** `模块：课程资源分享` `知识点：触发器 / 数据库硬约束`

**参考答案：** 数据库触发器兜底。插入或更新 `course_resource_bests` 时会查询资源状态，不是 `published` 就抛出 `course_resource_bests_resource_published_chk`。

**实现位置：** `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:37-68`；错误翻译在 `lib/modules/course-resources/courseResources.service.ts:81-83`。

### Q55：如果用户绕过正常流程，把积分加给非作者，谁兜底？
**标签：** `模块：课程资源分享` `知识点：复合外键 / 非法行为防护`

**参考答案：** 数据库复合外键兜底。`course_resource_score_events(resource_id,user_id)` 必须引用 `course_resources(id,created_by)`，所以积分用户必须是资源作者。

**实现位置：** `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:20-26`。

### Q56：如果用户绕过正常流程，把资源专业写错，谁兜底？
**标签：** `模块：课程资源分享` `知识点：复合外键 / 受控冗余`

**参考答案：** 数据库复合外键兜底。`course_resources(course_id,major_id)` 必须引用 `courses(id,major_id)`，不允许课程和专业组合不匹配。

**实现位置：** `packages/db/migrations/0012_course_design_constraints.sql:138-147`。

### Q57：如果管理员同时修改同一角色权限，会不会出现半更新？
**标签：** `模块：平台基础` `知识点：事务 / 整体替换`

**参考答案：** 权限更新是“删旧权限，再插新权限”的整体替换操作，放在事务里执行。事务失败会整体回滚，不会留下只删未插或只插一部分的状态。

**实现位置：** `lib/modules/rbac/rbac.service.ts:247-254`。

### Q58：哪些地方体现了 1NF？
**标签：** `模块：全局` `知识点：1NF / 原子性`

**参考答案：** 预约参与人没有存成逗号字符串，而是 `facility_reservation_participants`；用户角色没有存成 JSON 权限列表，而是 `user_roles`、`role_permissions`；专业负责人没有存成负责人列表，而是 `major_leads`。这些都把多值属性拆成关系表。

**实现位置：** `facility_reservation_participants` 在 `packages/db/migrations/0006_facility_reservations.sql:112-124`；`user_roles/role_permissions` 在 `packages/db/migrations/0001_baseline.sql:106-124`；`major_leads` 在 `packages/db/migrations/0004_course_resources.sql:47-55`。

### Q59：哪些表可以说基本满足 3NF？
**标签：** `模块：全局` `知识点：3NF`

**参考答案：** `roles`、`permissions`、`facility_rooms`、`facility_reservations`、`majors`、`courses` 等主体表基本满足 3NF，因为非主属性直接描述主键标识的实体或事实，没有明显非主属性传递依赖。需要特别解释的是闭包表、审计快照和课程资源中的受控冗余。

**实现位置：** `roles/permissions/user_roles/role_permissions` 在 `packages/db/migrations/0001_baseline.sql:106-124`；`facility_rooms/facility_reservations` 在 `packages/db/migrations/0006_facility_reservations.sql:35-95`；`majors/courses/course_resources` 在 `packages/db/migrations/0004_course_resources.sql:27-145`。

### Q60：哪些表可以说接近 BCNF？
**标签：** `模块：全局` `知识点：BCNF / 桥接表`

**参考答案：** 多数桥接表接近 BCNF，如 `user_roles(user_id,role_id)`、`role_permissions(role_id,permission_id)`、`major_leads(major_id,user_id)`、`facility_reservation_participants(reservation_id,user_id)`。这些表的主要决定因素就是候选键本身，没有额外的非键决定关系。

**实现位置：** 这些桥接表分别在 `packages/db/migrations/0001_baseline.sql:106-124`、`packages/db/migrations/0004_course_resources.sql:47-55`、`packages/db/migrations/0006_facility_reservations.sql:112-124`。

### Q61：你项目中有哪些“有意冗余”？如何防止老师认为这是设计错误？
**标签：** `模块：全局` `知识点：受控冗余 / 设计取舍`

**参考答案：** 有三类：`department_closure` 是层级查询派生表；`audit_logs.actor_name/actor_email/actor_roles` 是历史快照；`course_resources.major_id`、`score_events.major_id/user_id` 是为了范围过滤和排行榜统计保留的受控冗余。答辩时要主动说明目的，并说明一致性由触发器或复合外键保证。

**实现位置：** 闭包表在 `packages/db/migrations/0002_infra.sql:65-75`；审计快照在 `packages/db/migrations/0016_audit_actor_snapshot_strategy.sql:1-44`；课程资源复合外键在 `packages/db/migrations/0012_course_design_constraints.sql:138-158` 和 `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:20-26`。

### Q62：你项目里哪些规则是服务层前置校验，哪些是数据库硬约束？
**标签：** `模块：全局` `知识点：职责边界`

**参考答案：** 服务层负责友好提示、流程编排和事务顺序，例如预约前查冲突、提交资源前检查文件完整性。数据库硬约束负责最终拒绝非法数据，例如预约排斥约束、参与人延迟触发器、课程资源复合外键、状态一致性 `CHECK`、最佳推荐发布态触发器。

**实现位置：** 预约服务层事务在 `lib/modules/facilities/facilities.service.ts:407-445`；资源审核事务在 `lib/modules/course-resources/courseResources.service.ts:1848-1874`；主要数据库硬约束在 `packages/db/migrations/0012_course_design_constraints.sql`、`0013_course_resource_author_and_best_constraints.sql`、`0014_facility_reservation_status_consistency.sql`。

### Q63：你最适合现场演示哪三个“数据库拒绝非法数据”的例子？
**标签：** `模块：全局` `知识点：约束验证 / 答辩演示`

**参考答案：** 第一，同一房间相交时间段预约被排斥约束拒绝。第二，少于 3 名参与人或申请人不一致的预约在提交时被延迟触发器拒绝。第三，资源 `course_id/major_id` 不匹配被复合外键拒绝。这三个例子分别覆盖并发冲突、跨行约束和受控冗余一致性。

**实现位置：** `packages/db/migrations/0012_course_design_constraints.sql:8-18`、`0012_course_design_constraints.sql:20-108`、`0012_course_design_constraints.sql:138-147`。

### Q64：你项目里哪里体现了事务的 ACID？
**标签：** `模块：全局` `知识点：事务 / ACID`

**参考答案：** 创建预约体现原子性：预约主表和参与人要么一起写入，要么一起回滚；一致性由外键、排斥约束和触发器保证；隔离性通过房间行锁和数据库约束处理并发；持久性由数据库提交保证。审核资源和写积分也是同一业务原子单元。

**实现位置：** 创建预约事务在 `lib/modules/facilities/facilities.service.ts:407-445`；审核通过加积分事务在 `lib/modules/course-resources/courseResources.service.ts:1848-1874`。

### Q65：如果老师问“你是否考虑了幻读”，你怎么回答？
**标签：** `模块：功能房预约` `知识点：幻读 / 并发控制`

**参考答案：** 预约冲突确实是典型范围查询并发问题，单纯“先查再插”可能受幻读或竞态影响。因此我没有只依赖查询结果，而是用数据库排斥约束表达最终不变量：同一房间活跃时间段不能重叠。这样即使出现并发插入，数据库也会拒绝最终冲突。

**实现位置：** 服务层预查在 `lib/modules/facilities/facilities.service.ts:360-370`；最终硬约束在 `packages/db/migrations/0012_course_design_constraints.sql:8-18`。

### Q66：如果老师问“为什么不用最高隔离级别解决预约冲突”，你怎么回答？
**标签：** `模块：功能房预约` `知识点：隔离级别 / 约束优先`

**参考答案：** 提高隔离级别可以减少异常，但预约冲突本质是业务不变量，最直接的表达方式是数据库排斥约束。隔离级别是事务可见性策略，排斥约束是数据规则本身。当前用行锁降低竞争，用排斥约束做最终保证，比单纯依赖 Serializable 更清晰。

**实现位置：** 行锁在 `lib/modules/facilities/facilities.service.ts:346-355`；排斥约束在 `packages/db/migrations/0012_course_design_constraints.sql:8-18`。

### Q67：如果老师问“你用了哪些触发器”，不要笼统回答，具体说哪几个？
**标签：** `模块：全局` `知识点：触发器 / 数据库对象`

**参考答案：** 平台基础中有部门防环、闭包表维护、审计日志禁止更新删除；功能房中有预约参与人一致性延迟触发器；课程资源中有最佳推荐必须发布态，以及资源离开发布态自动删除最佳记录。这些触发器都对应数据库层必须维护的不变量。

**实现位置：** 部门防环在 `packages/db/migrations/0002_infra.sql:92-125`；审计 append-only 在 `0002_infra.sql:297-320`；预约参与人触发器在 `packages/db/migrations/0012_course_design_constraints.sql:20-108`；最佳推荐触发器在 `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:37-95`。

### Q68：如果老师问“哪些索引是有业务依据的”，你怎么具体回答？
**标签：** `模块：全局` `知识点：索引设计`

**参考答案：** 功能房的 `(room_id,start_at,end_at)` 服务房间时间线和冲突检测，活跃部分索引只服务 `pending/approved`；课程资源的 `status/major_id/course_id/created_by/download_count` 服务审核列表、专业课程过滤、作者作品和下载榜；审计日志的时间、操作者、动作、目标索引用于追溯查询。

**实现位置：** 功能房索引在 `packages/db/migrations/0006_facility_reservations.sql:97-105`；课程资源索引在 `packages/db/migrations/0004_course_resources.sql:147-160`、`0004_course_resources.sql:186-204`；审计索引在 `packages/db/migrations/0002_infra.sql:292-295`。

### Q69：如果老师问“你当前设计还有什么不足”，你说哪个最安全？
**标签：** `模块：功能房预约` `知识点：边界说明 / 自我评估`

**参考答案：** 我会说 `facility_bans` 的自然过期语义仍可优化。当前活动封禁的唯一性按 `revoked_at is null` 判断；服务层会允许已过期封禁用户继续预约，但数据库唯一索引仍会认为这条封禁未撤销。后续可以加定时撤销或重新设计活动封禁判定。

**实现位置：** 服务层过期判断在 `lib/modules/facilities/facilities.service.ts:128-139`；数据库唯一索引在 `packages/db/migrations/0006_facility_reservations.sql:143`。

### Q70：如果只能讲 3 分钟数据库亮点，你按什么顺序讲？
**标签：** `模块：全局` `知识点：答辩策略`

**参考答案：** 第一讲功能房预约：事务、行锁、排斥约束、延迟触发器，说明并发和跨行约束。第二讲课程资源：受控冗余、复合外键、审核加积分事务、最佳推荐触发器。第三讲平台基础：RBAC 桥接表、部门闭包表、数据范围复合外键、审计 append-only。这个顺序最贴近老师会追问的数据库重点。

**实现位置：** 功能房核心在 `lib/modules/facilities/facilities.service.ts:346-445` 和 `packages/db/migrations/0012_course_design_constraints.sql:8-108`；课程资源核心在 `lib/modules/course-resources/courseResources.service.ts:1848-1874`、`2016-2049`，以及 `packages/db/migrations/0012_course_design_constraints.sql:138-219`、`packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:20-95`；平台基础核心在 `packages/db/migrations/0001_baseline.sql`、`0002_infra.sql`、`0015_module_dictionary_and_data_scope_fks.sql`、`0016_audit_actor_snapshot_strategy.sql`。
