# 平台基础代码导读

数据库结构主入口：`packages/db/final-ddl/course-design-final-schema.sql`。历史迁移只用于说明演进过程。

平台基础不是“工程底座”这么简单。它能回答老师关于：

- 用户资料和认证身份
- RBAC 权限模型
- 组织树和闭包表
- 数据范围控制
- 审计日志

这些数据库问题。

## 1. 用户身份与业务资料

位置：`packages/db/final-ddl/course-design-final-schema.sql:240-274`

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text null,
  student_id text not null,
  avatar_url text null,
  status public.profile_status not null default 'pending_approval',
  ...
  constraint profiles_student_id_format_chk check (student_id ~ '^[0-9]{16}$')
);

create unique index if not exists profiles_username_uq on public.profiles(username);
create unique index if not exists profiles_student_id_uq on public.profiles(student_id);
```

答辩口径：

- `auth.users` 是认证身份事实源。
- `profiles` 保存业务资料，主键和认证用户 ID 一致。
- `student_id` 是业务候选键之一，唯一且格式受控。

新版用户触发器：

位置：`packages/db/final-ddl/course-design-final-schema.sql:617-686`

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'name', '');
  v_student_id text := coalesce(new.raw_user_meta_data->>'studentId', '');
  v_requires_approval boolean := public.get_config_bool('registration.requiresApproval', false);
  v_status public.profile_status;
begin
  if new.email_confirmed_at is null then
    v_status := 'pending_email_verification';
  else
    v_status := case when v_requires_approval then 'pending_approval' else 'active' end;
  end if;

  insert into public.profiles (...)
  values (...);

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.code = 'user'
  on conflict do nothing;

  return new;
end;
$$;
```

答辩口径：

- 新用户注册后自动生成业务资料。
- 同时自动授予默认 `user` 角色。
- 这是数据库触发器维护身份和业务资料同步的例子。

## 2. RBAC：用户、角色、权限

位置：`packages/db/final-ddl/course-design-final-schema.sql:302-318`

```sql
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
```

答辩口径：

- 用户和角色是多对多，所以用 `user_roles`。
- 角色和权限也是多对多，所以用 `role_permissions`。
- 两张联系表用复合主键，天然防止重复授权。
- 如果在 `user_roles` 里保存 `role_name`，会出现部分依赖，应由 `roles` 表维护。

权限整体替换事务：

位置：`lib/modules/rbac/rbac.service.ts:247-254`

```ts
await db.transaction(async (tx) => {
  await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, params.roleId));

  if (permRows.length > 0) {
    await tx.insert(rolePermissions).values(
      permRows.map((p) => ({ roleId: params.roleId, permissionId: p.id })),
    );
  }
});
```

答辩口径：

- “删旧权限 + 插新权限”必须是一个事务。
- 否则可能出现只删未插的中间状态。

## 3. 部门树和闭包表

位置：`packages/db/final-ddl/course-design-final-schema.sql:151-183`

```sql
create table if not exists public.department_closure (
  ancestor_id uuid not null references public.departments(id) on delete cascade,
  descendant_id uuid not null references public.departments(id) on delete cascade,
  depth integer not null,
  primary key (ancestor_id, descendant_id),
  constraint department_closure_depth_chk check (depth >= 0)
);

create index if not exists department_closure_ancestor_id_idx on public.department_closure(ancestor_id);
create index if not exists department_closure_descendant_id_idx on public.department_closure(descendant_id);
```

答辩口径：

- `departments.parent_id` 表达直接父子关系。
- `department_closure` 表达任意祖先到后代的可达关系。
- 它不是普通冗余，而是为“部门及子部门”查询服务的派生关系表。

防环触发器：

位置：`packages/db/final-ddl/course-design-final-schema.sql:492-525`

```sql
create or replace function public.departments_assert_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception '非法 parent_id：不能指向自身';
  end if;

  if exists (
    select 1
    from public.department_closure
    where ancestor_id = new.id
      and descendant_id = new.parent_id
  ) then
    raise exception '非法移动：不能移动到自己的子部门下（会形成环）';
  end if;

  return new;
end;
$$;
```

答辩口径：

- 如果把某部门移动到自己的子树下，会形成环。
- 数据库通过触发器阻止这种非法层级。

## 4. 数据范围设计

基础表：

位置：`packages/db/final-ddl/course-design-final-schema.sql:365-399`

```sql
create table if not exists public.role_data_scopes (
  role_id uuid not null references public.roles(id) on delete cascade,
  module text not null,
  scope_type public.data_scope_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, module)
);

create table if not exists public.role_data_scope_departments (
  role_id uuid not null,
  module text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, module, department_id),
  constraint role_data_scope_departments_fk
    foreign key (role_id, module) references public.role_data_scopes(role_id, module) on delete cascade
);
```

答辩口径：

- `role_data_scopes` 表示某角色在某模块上的范围类型。
- `role_data_scope_departments` 表示 `custom` 范围下选中的部门。
- 明细表通过 `(role_id,module)` 复合外键依附主配置，不能脱离主配置存在。

模块字典和能力表：

位置：`packages/db/final-ddl/course-design-final-schema.sql:330-377`

```sql
create table if not exists public.app_modules (
  code text primary key,
  name text not null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_modules_code_format_chk check (code ~ '^[a-z][a-z0-9_]*$')
);

create table if not exists public.data_scope_modules (
  module_code text primary key,
  created_at timestamptz not null default now(),
  constraint data_scope_modules_module_code_fk
    foreign key (module_code) references public.app_modules(code) on delete restrict
);

alter table public.role_data_scopes
  add constraint role_data_scopes_module_fk
  foreign key (module)
  references public.data_scope_modules(module_code)
  on delete restrict;
```

答辩口径：

- `module` 不再是随便写的字符串。
- 只有登记到 `data_scope_modules` 的模块，才能配置数据范围。
- 这是域完整性和参照完整性的结合。

整体替换事务：

位置：`lib/modules/data-permission/dataPermission.service.ts:203-225`

```ts
await db.transaction(async (tx) => {
  await tx.delete(roleDataScopeDepartments).where(eq(roleDataScopeDepartments.roleId, params.roleId));
  await tx.delete(roleDataScopes).where(eq(roleDataScopes.roleId, params.roleId));

  if (normalized.length > 0) {
    await tx.insert(roleDataScopes).values(
      normalized.map((i) => ({
        roleId: params.roleId,
        module: i.module,
        scopeType: toDbScopeType(i.scopeType),
      })),
    );
  }

  const deptValues = normalized.flatMap((i) =>
    i.scopeType === "CUSTOM"
      ? i.departmentIds.map((departmentId) => ({
          roleId: params.roleId,
          module: i.module,
          departmentId,
        }))
      : [],
  );
});
```

答辩口径：

- 数据范围配置是父子表整体替换。
- 必须事务化，避免主配置和部门明细只更新一半。

## 5. 审计日志

表结构和索引：

位置：`packages/db/final-ddl/course-design-final-schema.sql:407-442`

```sql
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid not null,
  actor_email text null,
  actor_roles jsonb null,
  action text not null,
  target_type text not null,
  target_id text not null,
  success boolean not null default true,
  error_code text null,
  reason text null,
  diff jsonb null,
  request_id text null,
  ip text null,
  user_agent text null
);

create index if not exists audit_logs_occurred_at_idx on public.audit_logs(occurred_at);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_target_idx on public.audit_logs(target_type, target_id);
```

append-only 触发器：

位置：`packages/db/final-ddl/course-design-final-schema.sql:444-456`

```sql
create or replace function public.audit_logs_block_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'audit_logs 为只追加表，禁止更新或删除';
  return null;
end;
$$;

create trigger audit_logs_block_update
before update on public.audit_logs
for each row execute function public.audit_logs_block_mutation();

create trigger audit_logs_block_delete
before delete on public.audit_logs
for each row execute function public.audit_logs_block_mutation();
```

答辩口径：

- 审计日志是历史事实表。
- 不允许修改和删除，否则破坏追溯价值。

弱引用和快照策略：

位置：`packages/db/final-ddl/course-design-final-schema.sql:407-442`

```sql
comment on table public.audit_logs is
  '管理端审计日志；append-only。actor_user_id 为审计主体标识，故意不建立到 auth.users 的物理外键，避免用户删除或脱敏后破坏历史审计事实。';

comment on column public.audit_logs.actor_user_id is
  '审计主体标识（弱引用）。为保留历史事实，不建立到 auth.users 的物理外键。';

comment on column public.audit_logs.actor_name is
  '操作者姓名快照，保留事件发生时的可读身份语义。';
```

写审计代码：

位置：`lib/modules/audit/audit.service.ts:27-55`

```ts
async function getActorRoleCodes(userId: string) {
  const rows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roles.code));
  return rows.map((r) => r.code);
}

export async function writeAuditLog(params: WriteAuditLogParams) {
  const [actorRoleCodes, actorName] = await Promise.all([
    getActorRoleCodes(params.actor.userId),
    getActorName(params.actor.userId),
  ]);

  await db.insert(auditLogs).values({
    actorUserId: params.actor.userId,
    actorEmail: params.actor.email,
    actorName,
    actorRoles: { roleCodes: actorRoleCodes },
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    success: params.success,
    ...
  });
}
```

答辩口径：

- `actor_user_id` 是弱引用，不建强外键是有意设计。
- `actor_name`、`actor_email`、`actor_roles` 是审计快照，保留事件发生当时语义。
- 这不是普通主数据冗余，而是历史真实性优先。

JSON 结构检查：

位置：`packages/db/final-ddl/course-design-final-schema.sql:425-440`

```sql
add constraint audit_logs_actor_roles_object_chk check (
  actor_roles is null
  or case
    when jsonb_typeof(actor_roles) <> 'object' then false
    when not (actor_roles ? 'roleCodes') then true
    else jsonb_typeof(actor_roles -> 'roleCodes') = 'array'
  end
);
```

## 6. 平台基础的范式答法

可以这样回答：

- `roles`、`permissions`、`profiles`、`app_modules` 等主体表基本满足 3NF。
- `user_roles`、`role_permissions`、`user_departments`、`role_data_scope_departments` 等桥接表接近 BCNF。
- `department_closure` 是层级查询派生表。
- `audit_logs` 中的快照字段是审计历史表的有意冗余。
