# 课程资源分享代码导读

数据库结构主入口：`packages/db/final-ddl/course-design-final-schema.sql`。历史迁移只用于说明演进过程。

课程资源分享模块适合展示三类数据库能力：

- 主数据与事实表分层
- 规范化与受控冗余的取舍
- 审核流、积分、最佳推荐的事务和触发器

## 1. 表结构如何对应需求

位置：`packages/db/final-ddl/course-design-final-schema.sql:1074-1379`

| 需求 | 表 | 说明 |
|---|---|---|
| 专业管理 | `majors` | 专业主数据 |
| 课程管理 | `courses` | 课程属于专业 |
| 专业负责人 | `major_leads` | 专业和用户的多对多 |
| 资源投稿和审核 | `course_resources` | 资源主体和状态 |
| 最佳推荐 | `course_resource_bests` | 每个资源最多一条最佳事实 |
| 下载记录 | `course_resource_download_events` | 下载事实表 |
| 积分记录 | `course_resource_score_events` | 积分事实表 |

专业负责人：

```sql
create table if not exists public.major_leads (
  major_id uuid not null references public.majors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (major_id, user_id)
);
```

答辩口径：

- 一个专业可以有多个负责人，一个用户可以负责多个专业。
- 所以不是 `majors.leader_id`，而是桥接表。

课程：

```sql
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  major_id uuid not null references public.majors(id) on delete restrict,
  name text not null,
  ...
);

create unique index if not exists courses_major_name_active_uq
  on public.courses(major_id, name)
  where deleted_at is null;
```

答辩口径：

- 课程名不是全局唯一，不同专业可以都有同名课程。
- 业务候选键是专业内课程名。

## 2. 文件资源和外链资源如何防止字段混乱

最终约束位置：`packages/db/final-ddl/course-design-final-schema.sql:1203-1249`

```sql
add constraint course_resources_file_or_link_chk check (
  (
    resource_type = 'file'
    and link_url is null
    and link_url_normalized is null
    and (
      (
        status = 'draft'
        and file_bucket is null
        and file_key is null
        and file_name is null
        and file_size is null
        and sha256 is null
      )
      or
      (
        file_bucket is not null
        and file_key is not null
        and file_name is not null
        and file_size is not null
        and sha256 is not null
      )
    )
  )
  or
  (
    resource_type = 'link'
    and file_bucket is null
    and file_key is null
    and file_name is null
    and file_size is null
    and sha256 is null
    and (
      (
        status = 'draft'
        and link_url is null
        and link_url_normalized is null
      )
      or
      (
        link_url is not null
        and link_url_normalized is not null
      )
    )
  )
);
```

答辩口径：

- `resource_type='file'` 时，不允许混入外链字段。
- `resource_type='link'` 时，不允许混入文件字段。
- 草稿态允许暂时缺少文件或外链明细，因为实际流程可能先建草稿再补充。

提交审核前，服务层会再检查文件已完整回填：

位置：`lib/modules/course-resources/courseResources.service.ts:993-1012`

```ts
if (!row.fileBucket || !row.fileKey || !row.fileName || !row.fileSize || !row.sha256) {
  throw badRequest("文件资源未完成上传/回填，禁止提交审核");
}

const exists = await db
  .select({ id: courseResources.id })
  .from(courseResources)
  .where(
    and(
      isNull(courseResources.deletedAt),
      eq(courseResources.courseId, row.courseId),
      eq(courseResources.resourceType, "file"),
      eq(courseResources.sha256, row.sha256),
      sql`${courseResources.id} <> ${row.id}`,
    ),
  )
  .limit(1);
if (exists[0]) throw conflict("同一课程下已存在相同文件（sha256）");
```

## 3. 资源去重

位置：`packages/db/final-ddl/course-design-final-schema.sql:1305-1313`

```sql
create unique index if not exists course_resources_course_sha256_active_uq
  on public.course_resources(course_id, sha256)
  where deleted_at is null and resource_type = 'file';

create unique index if not exists course_resources_course_link_active_uq
  on public.course_resources(course_id, link_url_normalized)
  where deleted_at is null and resource_type = 'link';
```

答辩口径：

- 文件用 `sha256` 做内容去重。
- 外链用规范化后的 URL 去重。
- 只对未软删除记录生效，保留历史但不影响当前业务。

URL 规范化：

位置：`lib/modules/course-resources/courseResources.utils.ts:18-51`

```ts
export function normalizeExternalUrl(input: string) {
  const raw = input.trim();
  const withScheme = raw.startsWith("//") ? `https:${raw}` : hasScheme(raw) ? raw : `https://${raw}`;
  const url = new URL(withScheme);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http/https");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/g, "");
  }
  const entries = [...url.searchParams.entries()];
  entries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  url.search = "";
  for (const [k, v] of entries) url.searchParams.append(k, v);

  return url.toString();
}
```

## 4. `course_id + major_id` 是范式风险，也是受控冗余

老师很可能问：

> 课程已经属于专业，为什么资源表还要存 `major_id`？

你的回答：

- 严格看，存在 `course_id -> major_id`，所以 `course_resources.major_id` 是冗余。
- 保留它是为了按专业过滤、审核范围控制、排行榜统计更直接。
- 关键是它不是无约束冗余，而是用复合外键锁定一致性。

位置：`packages/db/final-ddl/course-design-final-schema.sql:1142-1201`

```sql
alter table public.courses
  add constraint courses_id_major_id_uq unique (id, major_id);

alter table public.course_resources
  add constraint course_resources_course_major_fk
  foreign key (course_id, major_id)
  references public.courses(id, major_id)
  on update cascade
  on delete restrict;
```

服务层也配合修正：

位置：`lib/modules/course-resources/courseResources.service.ts:920-924`

```ts
if (nextCourseId !== current.courseId || nextMajorId !== current.majorId) {
  await ensureMajorExists(nextMajorId);
  const course = await ensureCourseExists({ courseId: nextCourseId, majorId: nextMajorId });
  patch.majorId = course.majorId;
  patch.courseId = course.id;
}
```

错误翻译：

位置：`lib/modules/course-resources/courseResources.service.ts:59-62`

```ts
if (pg.constraint === "course_resources_course_major_fk") {
  return badRequest("课程与专业必须保持一致，禁止提交不一致的 major_id / course_id 组合");
}
```

## 5. 状态机一致性

位置：`packages/db/final-ddl/course-design-final-schema.sql:1251-1296`

```sql
add constraint course_resources_status_consistency_chk check (
  (
    status = 'draft'
    and submitted_at is null
    and reviewed_by is null
    and reviewed_at is null
    and review_comment is null
    and published_at is null
    and unpublished_at is null
  )
  or
  (
    status = 'pending'
    and submitted_at is not null
    and reviewed_by is null
    and reviewed_at is null
    and review_comment is null
    and published_at is null
    and unpublished_at is null
  )
  ...
);
```

提交审核：

位置：`lib/modules/course-resources/courseResources.service.ts:1038-1065`

```ts
if (!(row.status === "draft" || row.status === "rejected" || row.status === "unpublished")) {
  throw conflict("仅 draft/rejected/unpublished 状态允许提交审核");
}

await assertReadyForSubmit(row);

const updated = await db
  .update(courseResources)
  .set({
    status: "pending",
    submittedAt: sql`now()`,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    publishedAt: null,
    unpublishedAt: null,
    updatedBy: params.userId,
  })
  .where(
    and(
      eq(courseResources.id, row.id),
      eq(courseResources.createdBy, params.userId),
      inArray(courseResources.status, ["draft", "rejected", "unpublished"]),
    ),
  );
```

答辩口径：

- 服务层控制流程。
- 数据库约束防止手工构造矛盾状态。

## 6. 审核通过 + 首次积分事务

位置：`lib/modules/course-resources/courseResources.service.ts:1848-1874`

```ts
await db.transaction(async (tx) => {
  const updated = await tx
    .update(courseResources)
    .set({
      status: "published",
      reviewedBy: params.actor.userId,
      reviewedAt: sql`now()`,
      reviewComment: params.comment ?? null,
      publishedAt: sql`now()`,
      unpublishedAt: null,
      updatedBy: params.actor.userId,
    })
    .where(and(eq(courseResources.id, params.resourceId), eq(courseResources.status, "pending")))
    .returning({ id: courseResources.id });

  if (updated.length === 0) throw conflict("资源状态已变化，请刷新后重试");

  await tx
    .insert(courseResourceScoreEvents)
    .values({
      userId: detail.createdBy,
      majorId: detail.majorId,
      resourceId: detail.id,
      eventType: "approve",
      delta: Math.max(1, Math.trunc(approveDelta)),
    })
    .onConflictDoNothing();
});
```

答辩口径：

- 审核通过和首次积分是一个业务原子单元。
- `onConflictDoNothing()` 配合唯一约束，防止重复加分。

唯一约束：

位置：`packages/db/final-ddl/course-design-final-schema.sql:1351-1379`

```sql
create table if not exists public.course_resource_score_events (
  ...
  constraint course_resource_score_events_delta_chk check (delta > 0),
  constraint course_resource_score_events_first_uq unique (user_id, resource_id, event_type)
);
```

## 7. 积分事件的受控冗余

积分表保存 `user_id` 和 `major_id`，便于排行榜统计。但它们都必须和资源主体一致。

专业维度一致性：

位置：`packages/db/final-ddl/course-design-final-schema.sql:1351-1371`

```sql
alter table public.course_resource_score_events
  add constraint course_resource_score_events_resource_major_fk
  foreign key (resource_id, major_id)
  references public.course_resources(id, major_id)
  on update cascade
  on delete cascade;
```

作者归属一致性：

位置：`packages/db/final-ddl/course-design-final-schema.sql:1372-1378`

```sql
alter table public.course_resource_score_events
  add constraint course_resource_score_events_resource_user_fk
  foreign key (resource_id, user_id)
  references public.course_resources(id, created_by)
  on update cascade
  on delete cascade;
```

答辩口径：

- `score_events.user_id` 是为排行榜保存的冗余字段。
- 它必须等于资源作者，所以用 `(resource_id,user_id)` 复合外键锁定到 `course_resources(id,created_by)`。

## 8. 最佳推荐

服务层设置最佳：

位置：`lib/modules/course-resources/courseResources.service.ts:2016-2049`

```ts
if (before.status !== "published") throw conflict("仅已发布资源允许设为最佳");

await db.transaction(async (tx) => {
  await tx
    .insert(courseResourceBests)
    .values({ resourceId: params.resourceId, bestBy: params.actor.userId })
    .onConflictDoUpdate({
      target: courseResourceBests.resourceId,
      set: { bestBy: params.actor.userId, bestAt: sql`now()` },
    });

  await tx
    .insert(courseResourceScoreEvents)
    .values({
      userId: detail.createdBy,
      majorId: detail.majorId,
      resourceId: detail.id,
      eventType: "best",
      delta: Math.max(1, Math.trunc(bestDelta)),
    })
    .onConflictDoNothing();
});
```

数据库兜底：只有发布态资源才能设为最佳。

位置：`packages/db/final-ddl/course-design-final-schema.sql:1388-1421`

```sql
create or replace function public.course_resource_best_requires_published()
returns trigger
language plpgsql
as $$
declare
  v_status public.course_resource_status;
begin
  select cr.status
    into v_status
  from public.course_resources cr
  where cr.id = new.resource_id;

  if v_status <> 'published' then
    raise exception using
      errcode = '23514',
      constraint = 'course_resource_bests_resource_published_chk';
  end if;

  return new;
end;
$$;
```

下架自动撤销最佳：

位置：`packages/db/final-ddl/course-design-final-schema.sql:1423-1443`

```sql
create or replace function public.course_resource_drop_best_when_not_published()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'published' then
    delete from public.course_resource_bests
    where resource_id = new.id;
  end if;

  return new;
end;
$$;
```

## 9. 下载事件与下载计数

位置：`lib/modules/course-resources/courseResources.service.ts:396-408`

```ts
await db.transaction(async (tx) => {
  await tx.insert(courseResourceDownloadEvents).values({
    resourceId: row.id,
    userId: params.userId,
    ip: params.request.ip,
    userAgent: params.request.userAgent,
  });

  await tx
    .update(courseResources)
    .set({ downloadCount: sql`${courseResources.downloadCount} + 1`, lastDownloadAt: sql`now()` })
    .where(eq(courseResources.id, row.id));
});
```

答辩口径：

- 下载事件是明细事实，可用于统计和审计。
- `download_count` 是汇总冗余，用于排序和快速展示。
- 两者在同一事务中维护，避免计数和明细不一致。

## 10. 这个模块的范式答法

可以这样回答：

- `majors`、`courses`、`major_leads`、`download_events` 基本满足 3NF。
- `course_resources.major_id` 和 `score_events.major_id/user_id` 是有意受控冗余。
- 这些冗余用于专业范围过滤、排行榜统计和作者积分，但都由复合外键锁定一致性。
