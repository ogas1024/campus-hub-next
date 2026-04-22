# 校园生活平台概念结构设计与分层 ER 图

## 1. 编写目的

本文件用于支撑课程设计报告中的“概念结构设计”章节。

考虑到当前课题包含平台基础、功能房预约、课程资源分享三个主线模块，如果把全部实体和联系硬塞进一张图，会出现以下问题：

- 实体数量过多，可读性迅速下降
- 不同层次的关系混在一起，重点不突出
- 老师在阅读时难以快速看出“这一张图到底想说明什么”

因此，本文采用“先总览分层、再按模块拆图”的方式组织 E-R 图。

## 2. 绘图原则

为保证图示既适合报告排版，也适合答辩展示，本文遵循以下原则：

1. 不追求“一图画全”，而是按业务层次拆成多张小图。
2. 每张图只保留当前主题最关键的实体、主键、外键和识别性属性。
3. 桥接表、闭包表、事件事实表单独绘制，不把它们隐藏在文字里。
4. 对当前故意不建立物理外键、但存在业务联系的字段，在图外单独说明，避免误导。
5. 图的顺序按“总体分层 -> 模块主数据 -> 模块事务/事件”展开，使老师能顺着讲解逻辑阅读。

## 3. 总体分层视图

下面这张图不承担细节表达，而只说明本次数据库课程设计的四个结构层次：

```mermaid
flowchart LR
  subgraph P[平台基础子系统]
    P1[身份与资料]
    P2[组织结构]
    P3[RBAC 与数据范围]
    P4[审计与配置]
  end

  subgraph F[功能房预约子系统]
    F1[楼房与房间]
    F2[预约与参与人]
    F3[封禁与运营控制]
  end

  subgraph R[课程资源分享子系统]
    R1[专业与课程]
    R2[资源主体与审核]
    R3[推荐、下载与积分事实]
  end

  subgraph L[数字图书馆扩展]
    L1[图书主体与资产]
    L2[收藏与下载事实]
  end

  P --> F
  P --> R
  R -. 同构扩展 .-> L
```

说明：

- 平台基础子系统是其他模块的公共底座
- 功能房预约与课程资源分享是本次课程设计的两个核心业务案例
- 数字图书馆可视为“与课程资源相近的下载型内容业务扩展”

## 4. 平台基础子系统 ER 图

### 4.1 身份、资料与组织结构

这一张图只关注“人从哪里来、属于哪些部门、担任哪些岗位、部门之间如何形成层级结构”。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  profiles {
    uuid id PK,FK
    text name
    text student_id UK
    enum status
  }

  departments {
    uuid id PK
    uuid parent_id FK
    text name
    int sort
  }

  department_closure {
    uuid ancestor_id PK,FK
    uuid descendant_id PK,FK
    int depth
  }

  user_departments {
    uuid user_id PK,FK
    uuid department_id PK,FK
  }

  positions {
    uuid id PK
    text code UK
    text name
    bool enabled
  }

  user_positions {
    uuid user_id PK,FK
    uuid position_id PK,FK
  }

  auth_users ||--|| profiles : extends
  departments ||--o{ departments : parent_of
  departments ||--o{ department_closure : ancestor
  departments ||--o{ department_closure : descendant
  auth_users ||--o{ user_departments : belongs
  departments ||--o{ user_departments : contains
  auth_users ||--o{ user_positions : holds
  positions ||--o{ user_positions : assigns
```

图示重点：

- `profiles` 与 `auth.users` 是一对一扩展关系
- `departments` 既有自引用父子关系，也有 `department_closure` 闭包表
- 用户与部门、岗位都是多对多关系，因此使用桥接表拆分

### 4.2 RBAC 与数据范围配置

这一张图只关注“用户拥有哪些角色、角色拥有哪些权限、角色在某模块上拥有哪些数据范围配置”。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  roles {
    uuid id PK
    text code UK
    text name
  }

  permissions {
    uuid id PK
    text code UK
  }

  app_modules {
    text code PK
    text name UK
  }

  data_scope_modules {
    text module_code PK,FK
  }

  user_roles {
    uuid user_id PK,FK
    uuid role_id PK,FK
  }

  role_permissions {
    uuid role_id PK,FK
    uuid permission_id PK,FK
  }

  role_data_scopes {
    uuid role_id PK,FK
    text module PK
    enum scope_type
  }

  role_data_scope_departments {
    uuid role_id PK
    text module PK
    uuid department_id PK,FK
  }

  departments {
    uuid id PK
    text name
  }

  auth_users ||--o{ user_roles : has
  roles ||--o{ user_roles : granted_to
  roles ||--o{ role_permissions : owns
  permissions ||--o{ role_permissions : contains
  app_modules ||--o| data_scope_modules : enables
  data_scope_modules ||--o{ role_data_scopes : governs
  roles ||--o{ role_data_scopes : configures
  role_data_scopes ||--o{ role_data_scope_departments : maps
  departments ||--o{ role_data_scope_departments : selects
```

图示重点：

- `user_roles` 和 `role_permissions` 是标准 RBAC 桥接关系
- `app_modules` 与 `data_scope_modules` 把“模块主数据”与“支持数据权限的模块集合”拆开建模
- `role_data_scopes` 以 `(role_id, module)` 为识别键
- `role_data_scope_departments` 是以复合外键依附于 `role_data_scopes` 的子关系

### 4.3 审计与平台配置支撑结构

这一张图只关注平台级支撑数据，不与前两张图混在一起。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  app_config {
    text key PK
    jsonb value
    uuid updated_by FK
  }

  app_modules {
    text code PK
    text name UK
  }

  data_scope_modules {
    text module_code PK,FK
  }

  audit_logs {
    uuid id PK
    timestamptz occurred_at
    uuid actor_user_id
    text actor_name
    text action
    text target_type
    text target_id
    bool success
  }

  auth_users ||--o{ app_config : updates
  app_modules ||--o| data_scope_modules : enables
```

说明：

- `app_config.updated_by` 与用户存在物理外键关系
- `audit_logs.actor_user_id` 在业务上表示操作者，但当前数据库故意未建立物理外键
- `audit_logs.actor_name`、`actor_email`、`actor_roles` 用于保留事件发生时的身份快照
- 因此图中不把 `audit_logs` 画成与 `auth_users` 的硬连接，避免把“业务关联”误写成“数据库已强约束”

## 5. 功能房预约子系统 ER 图

### 5.1 空间资源层

这一张图只说明“楼房和房间”的空间主数据结构。

```mermaid
erDiagram
  facility_buildings {
    uuid id PK
    text name UK
    bool enabled
    int sort
  }

  facility_rooms {
    uuid id PK
    uuid building_id FK
    int floor_no
    text name
    int capacity
    bool enabled
  }

  facility_buildings ||--o{ facility_rooms : contains
```

图示重点：

- 房间从属于楼房
- 房间的业务唯一性不是全局名称唯一，而是 `(building_id, floor_no, name)` 范围内唯一

### 5.2 预约事务层

这一张图展示功能房模块最核心的事务性结构：预约主体、申请人、参与人和房间之间的关系。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  facility_rooms {
    uuid id PK
    uuid building_id FK
    text name
  }

  facility_reservations {
    uuid id PK
    uuid room_id FK
    uuid applicant_id FK
    timestamptz start_at
    timestamptz end_at
    enum status
    uuid reviewed_by FK
    uuid cancelled_by FK
  }

  facility_reservation_participants {
    uuid reservation_id PK,FK
    uuid user_id PK,FK
    bool is_applicant
  }

  facility_rooms ||--o{ facility_reservations : schedules
  auth_users ||--o{ facility_reservations : applies
  facility_reservations ||--o{ facility_reservation_participants : includes
  auth_users ||--o{ facility_reservation_participants : participates
```

图示重点：

- `facility_reservations` 是事务主表
- `facility_reservation_participants` 是参与人桥接表
- 申请人既体现在主表 `applicant_id` 中，也会在参与人表中以 `is_applicant=true` 的方式出现
- 当前数据库还通过延迟约束触发器保证“至少 3 名参与人 + 恰有一个申请人 + 与 `applicant_id` 一致”

### 5.3 模块治理层

这一张图单独说明“封禁”这一治理结构，避免把它和预约事务主链混在一起。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  facility_bans {
    uuid id PK
    uuid user_id FK
    timestamptz expires_at
    timestamptz revoked_at
    uuid created_by FK
    uuid revoked_by FK
  }

  auth_users ||--o{ facility_bans : banned
```

说明：

- `facility_bans` 负责管理“模块访问限制”，而不是预约过程本身
- 它与预约表分离，可以更清楚地表达“主体行为记录”和“治理措施记录”的差别

## 6. 课程资源分享子系统 ER 图

### 6.1 教学主数据层

这一张图说明专业、课程、专业负责人之间的教学层级关系。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  majors {
    uuid id PK
    text name UK
    bool enabled
  }

  courses {
    uuid id PK
    uuid major_id FK
    text name
    text code
    bool enabled
  }

  major_leads {
    uuid major_id PK,FK
    uuid user_id PK,FK
  }

  majors ||--o{ courses : contains
  majors ||--o{ major_leads : assigns
  auth_users ||--o{ major_leads : serves
```

图示重点：

- `majors -> courses` 形成清晰的教学主数据层次
- `major_leads` 是负责人桥接关系，不把负责人字段直接塞进 `majors`

### 6.2 资源主体与审核流

这一张图展示课程资源主体如何依附于专业、课程和用户。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  majors {
    uuid id PK
    text name UK
  }

  courses {
    uuid id PK
    uuid major_id FK
    text name
  }

  course_resources {
    uuid id PK
    uuid major_id FK
    uuid course_id FK
    uuid created_by FK
    enum resource_type
    enum status
    timestamptz submitted_at
    timestamptz reviewed_at
    timestamptz published_at
    timestamptz unpublished_at
  }

  majors ||--o{ courses : contains
  majors ||--o{ course_resources : scopes
  courses ||--o{ course_resources : contains
  auth_users ||--o{ course_resources : submits
```

图示重点：

- `course_resources` 同时连接 `major_id` 和 `course_id`
- 从数据库理论角度看，这里存在需要主动解释的“受控冗余”
- 但这一受控冗余现在已经由 `(course_id, major_id)` 复合外键锁定一致性
- 该图正好适合答辩时引出“规范化与必要冗余之间的权衡”

### 6.3 推荐、下载与积分事实层

这一张图专门展示资源发布后的事实记录层，而不再与主数据层混画。

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  majors {
    uuid id PK
    text name UK
  }

  course_resources {
    uuid id PK
    uuid course_id FK
    uuid major_id FK
    text title
    enum status
  }

  course_resource_bests {
    uuid resource_id PK,FK
    uuid best_by FK
    timestamptz best_at
  }

  course_resource_download_events {
    uuid id PK
    uuid resource_id FK
    uuid user_id FK
    timestamptz occurred_at
  }

  course_resource_score_events {
    uuid id PK
    uuid user_id FK
    uuid major_id FK
    uuid resource_id FK
    enum event_type
    int delta
  }

  course_resources ||--o| course_resource_bests : marked_as_best
  auth_users ||--o{ course_resource_bests : marks
  course_resources ||--o{ course_resource_download_events : downloaded
  auth_users ||--o{ course_resource_download_events : downloads
  course_resources ||--o{ course_resource_score_events : generates
  auth_users ||--o{ course_resource_score_events : earns
  majors ||--o{ course_resource_score_events : groups
```

说明：

- `course_resource_bests.resource_id` 已有物理外键，因此画出与资源的一对一事实关系
- `course_resource_bests.best_by` 现在已经建立到 `auth.users.id` 的物理外键，因此画出与用户的硬连接
- `course_resource_score_events` 还通过复合外键与资源主体锁定了“专业维度一致性”和“作者归属一致性”
- 下载事件和积分事件都是事实表，它们与资源主表分离是本模块的重要设计亮点

## 7. 数字图书馆扩展 ER 图

数字图书馆是可选扩展，但它与课程资源模块在“下载型内容平台”建模上具有明显同构性，因此适合作为扩展案例。

### 7.1 图书主体与资产结构

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  library_books {
    uuid id PK
    text isbn13 UK
    text title
    text author
    enum status
    uuid created_by FK
  }

  library_book_assets {
    uuid id PK
    uuid book_id FK
    enum asset_type
    enum file_format
    text link_url_normalized
    uuid created_by FK
  }

  auth_users ||--o{ library_books : submits
  library_books ||--o{ library_book_assets : owns
  auth_users ||--o{ library_book_assets : uploads
```

图示重点：

- 图书主体与资产拆表，避免在主表中堆叠多格式文件字段
- “一本书可对应多个资产”这一建模方式，比单文件图书表更适合数据库课程设计表达

### 7.2 收藏与下载事实层

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  library_books {
    uuid id PK
    text isbn13 UK
    text title
  }

  library_book_assets {
    uuid id PK
    uuid book_id FK
    enum asset_type
  }

  library_book_favorites {
    uuid book_id PK,FK
    uuid user_id PK,FK
  }

  library_book_download_events {
    uuid id PK
    uuid book_id FK
    uuid asset_id FK
    uuid user_id FK
    timestamptz occurred_at
  }

  library_books ||--o{ library_book_favorites : favored_by
  auth_users ||--o{ library_book_favorites : favorites
  library_books ||--o{ library_book_download_events : downloaded
  library_book_assets ||--o{ library_book_download_events : via_asset
  auth_users ||--o{ library_book_download_events : downloads
```

## 8. 报告与答辩中的使用建议

若要把这些图真正用在课程设计报告和答辩中，建议采用下面的展示顺序：

1. 先展示“总体分层视图”，让老师知道本次设计并不是杂糅的一堆功能。
2. 平台基础优先讲 `4.1` 和 `4.2`，突出组织树、RBAC、数据范围这些数据库味最强的部分。
3. 功能房预约重点讲 `5.2`，突出时间冲突排斥约束、延迟约束触发器和事务协同。
4. 课程资源重点讲 `6.2` 和 `6.3`，突出受控冗余、复合外键锁定一致性、事件事实表与首次积分语义。
5. 数字图书馆只作为“模型可复用的扩展案例”简要补充，不抢主线。

这样讲，老师更容易看到你是在“用数据库建模复杂业务”，而不是只做了几个页面。
