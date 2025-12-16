# 功能房预约 需求说明
**状态**：🟠 待完善  
**版本**：v0.1  
**最近更新**：2025-12-11

## 范围（Scope）
- 目标：学生提交功能房预约，管理端审核，支持状态流转与冲突校验。
- MVP：创建/列表/详情、审批通过/驳回、时间段唯一性约束、个人历史查询。
- 非目标：收费、外部支付、硬件联动。

## 角色与权限
- user：创建预约、查看本人预约。
- staff/admin：查看全部、审批（campus:facility:approve）。

## 关键用例
- 作为 user，在前台我要选择日期与时间段提交预约。
- 作为 staff，在后台我要按日期筛选并审批预约。

## 领域模型
- Reservation：id、facilityId、userId、timeSlot、status、reason、auditLogRef。
- Facility：id、name、location、capacity、status。

## 业务规则与约束
- (facilityId, timeSlot) 唯一。
- 状态机：draft → pending → approved/rejected。

## 开放问题
- 审批是否需要二级审核？
- 是否需要提前可用性校验与节假日日历？
