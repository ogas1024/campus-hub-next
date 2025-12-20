# 需求文档（Requirements）

本目录按业务模块存放需求与用例，作为“设计/实现”的前置契约。每个模块文件覆盖范围、非目标、角色与用例、领域模型与开放问题，并随迭代更新状态。

## 目录与状态
- ✅ 已批准：可直接进入设计/开发
- 🟠 待完善：结构存在但内容未补全
- 🔍 草稿：正在收集信息

- ✅ [身份与访问控制（IAM）](./iam.md)
- ✅ [组织与岗位（Organization）](./organization.md)
- ✅ [数据范围与数据权限（Data Permission）](./data-permission.md)
- ✅ [审计日志（Audit）](./audit.md)
- ✅ [Console 信息架构（IA）](./console-ia.md)
- ✅ [功能房预约](./facility-reservation.md)
- ✅ [课程资源分享](./course-resources.md)
- ✅ [通知公告](./notices.md)
- ✅ [问卷](./surveys.md)
- ✅ [收集引擎（Collect Engine）](./collect-engine.md)
- ✅ [材料收集](./materials.md)
- 🟠 [数字图书馆](./library.md)
- 🟠 [失物招领](./lost-found.md)
- ✅ [鉴权与用户](./auth.md)
- 🟠 [用户管理（历史拆分稿）](./user-management.md)

## 编写模板

```markdown
# <模块> 需求说明
**状态**：草稿 / 待完善 / 已批准
**版本**：v0.x
**最近更新**：YYYY-MM-DD

## 范围（Scope）
- 目标与问题陈述
- MVP 边界（明确本轮不做的能力）

## 角色与权限
- 角色列表与可执行操作
- 权限码对照（campus:<module>:<op>）

## 关键用例
- 作为 <角色>，在 <入口>，我要 <做什么>，以便 <价值>。

## 领域模型
- 实体/属性/关系描述或简易 ER 图

## 业务规则与约束
- 校验、状态机、幂等、唯一性等

## 开放问题
- 待确认的需求或依赖
```

## 维护原则
- 文档驱动：需求→设计→API→实现保持映射
- 单一事实来源：需求变更先更新本目录，再同步设计/接口
- 版本留痕：重要修改在顶部更新版本与日期
