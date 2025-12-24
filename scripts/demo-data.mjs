#!/usr/bin/env node
/**
 * Demo 数据生成/清理脚本（仅用于开发/演示环境）。
 *
 * - seed：创建/补齐演示账号 + 生成各模块演示数据（幂等）
 * - reset：删除由本脚本生成的演示数据（需要显式确认）
 *
 * 注意：
 * - 该脚本会写入数据库（bulk insert/update/delete），请勿对生产库执行。
 * - 账号创建使用 Supabase Admin API（需要 SUPABASE_SERVICE_ROLE_KEY）。
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import postgres from "postgres";

const DEMO_NAME_PREFIX = "DEMO·";
const DEMO_TITLE_PREFIX = "【DEMO】";
const DEMO_USER_AGENT = "demo-seed";

function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const fileName of envFiles) {
    const path = resolve(process.cwd(), fileName);
    if (!existsSync(path)) continue;
    dotenv.config({ path, override: false });
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value || !String(value).trim()) throw new Error(`缺少环境变量：${key}`);
  return String(value).trim();
}

function normalizeExternalUrl(raw) {
  const url = new URL(raw);
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/g, "");
  return url.toString();
}

function isYes(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "yes";
}

function logSection(title) {
  console.log(`\n== ${title} ==`);
}

async function assertSchemaReady(sql) {
  const requiredTables = [
    "public.app_config",
    "public.roles",
    "public.permissions",
    "public.profiles",
    "public.departments",
    "public.positions",
    "public.notices",
    "public.majors",
    "public.courses",
    "public.course_resources",
    "public.course_resource_download_events",
    "public.course_resource_score_events",
    "public.facility_buildings",
    "public.facility_rooms",
    "public.facility_reservations",
    "public.library_books",
    "public.library_book_assets",
    "public.lostfound_items",
    "public.surveys",
    "public.survey_questions",
    "public.survey_responses",
    "public.votes",
    "public.vote_questions",
    "public.vote_responses",
  ];

  const missing = [];
  for (const table of requiredTables) {
    // to_regclass 返回 null 表示不存在
    const rows = await sql`select to_regclass(${table}) as reg`;
    if (!rows[0]?.reg) missing.push(table);
  }

  if (missing.length > 0) {
    throw new Error(
      [
        "数据库结构不完整（缺少关键表），请先在 Supabase SQL Editor 按顺序执行迁移：",
        "packages/db/migrations/0001_baseline.sql ~ 0011_votes.sql",
        "",
        "缺少：",
        ...missing.map((t) => `- ${t}`),
      ].join("\n"),
    );
  }
}

function createSupabaseAdminClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findAuthUserByEmail(supabase, email) {
  const target = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Supabase listUsers 失败：${error.message}`);
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) break;
  }

  return null;
}

async function ensureAuthUser(supabase, params) {
  const password = params.password;
  const email = params.email;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: params.name, studentId: params.studentId },
  });

  if (!error && data?.user?.id) return data.user;

  const message = error?.message ?? "";
  const mayExist = /already/i.test(message) || /exists/i.test(message);
  if (!mayExist) throw new Error(`创建演示账号失败：${email}：${message || "未知错误"}`);

  const existing = await findAuthUserByEmail(supabase, email);
  if (!existing?.id) throw new Error(`账号已存在但无法读取 userId：${email}`);

  const update = await supabase.auth.admin.updateUserById(existing.id, {
    user_metadata: { name: params.name, studentId: params.studentId },
    email_confirm: true,
  });
  if (update.error) throw new Error(`更新演示账号元数据失败：${email}：${update.error.message}`);

  return update.data.user;
}

async function ensureRoleExists(sql, roleCode) {
  const rows = await sql`select id from public.roles where code = ${roleCode} limit 1`;
  const id = rows[0]?.id;
  if (!id) throw new Error(`缺少角色：${roleCode}（请确认迁移已执行）`);
  return id;
}

async function ensureUserRole(sql, userId, roleCode) {
  await ensureRoleExists(sql, roleCode);
  await sql`
    insert into public.user_roles (user_id, role_id)
    select ${userId}::uuid, r.id
    from public.roles r
    where r.code = ${roleCode}
    on conflict do nothing
  `;
}

async function forceProfileActive(sql, userId) {
  await sql`
    update public.profiles
    set status = 'active', updated_at = now()
    where id = ${userId}::uuid
  `;
}

async function ensureDepartment(sql, params) {
  const rows = await sql`select id from public.departments where name = ${params.name} limit 1`;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.departments
      set parent_id = ${params.parentId ?? null}::uuid, sort = ${params.sort}
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.departments (name, parent_id, sort)
    values (${params.name}, ${params.parentId ?? null}::uuid, ${params.sort})
    returning id
  `;
  return inserted[0].id;
}

async function ensurePosition(sql, params) {
  const rows = await sql`select id from public.positions where name = ${params.name} limit 1`;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.positions
      set code = ${params.code}, description = ${params.description ?? null}, enabled = ${params.enabled}, sort = ${params.sort}
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.positions (code, name, description, enabled, sort)
    values (${params.code}, ${params.name}, ${params.description ?? null}, ${params.enabled}, ${params.sort})
    returning id
  `;
  return inserted[0].id;
}

async function ensureUserDepartment(sql, userId, departmentId) {
  await sql`
    insert into public.user_departments (user_id, department_id)
    values (${userId}::uuid, ${departmentId}::uuid)
    on conflict do nothing
  `;
}

async function ensureUserPosition(sql, userId, positionId) {
  await sql`
    insert into public.user_positions (user_id, position_id)
    values (${userId}::uuid, ${positionId}::uuid)
    on conflict do nothing
  `;
}

async function ensureNotice(sql, params) {
  const rows = await sql`
    select id
    from public.notices
    where title = ${params.title} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.notices
      set content_md = ${params.contentMd},
          status = ${params.status},
          visible_all = ${params.visibleAll},
          pinned = ${params.pinned},
          pinned_at = ${params.pinnedAt ?? null},
          publish_at = ${params.publishAt ?? null},
          expire_at = ${params.expireAt ?? null},
          updated_by = ${params.updatedBy ?? null}::uuid,
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.notices (
      title, content_md, status,
      visible_all, pinned, pinned_at,
      publish_at, expire_at,
      created_by, updated_by
    )
    values (
      ${params.title}, ${params.contentMd}, ${params.status},
      ${params.visibleAll}, ${params.pinned}, ${params.pinnedAt ?? null},
      ${params.publishAt ?? null}, ${params.expireAt ?? null},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function ensureNoticeRead(sql, noticeId, userId, readAt) {
  await sql`
    insert into public.notice_reads (notice_id, user_id, read_at)
    values (${noticeId}::uuid, ${userId}::uuid, ${readAt})
    on conflict do nothing
  `;
}

async function ensureMajor(sql, params) {
  const rows = await sql`
    select id
    from public.majors
    where name = ${params.name} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.majors
      set enabled = ${params.enabled}, sort = ${params.sort}, remark = ${params.remark ?? null}
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.majors (name, enabled, sort, remark)
    values (${params.name}, ${params.enabled}, ${params.sort}, ${params.remark ?? null})
    returning id
  `;
  return inserted[0].id;
}

async function ensureCourse(sql, params) {
  const rows = await sql`
    select id
    from public.courses
    where major_id = ${params.majorId}::uuid and name = ${params.name} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.courses
      set code = ${params.code ?? null}, enabled = ${params.enabled}, sort = ${params.sort}, remark = ${params.remark ?? null}
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.courses (major_id, name, code, enabled, sort, remark)
    values (${params.majorId}::uuid, ${params.name}, ${params.code ?? null}, ${params.enabled}, ${params.sort}, ${params.remark ?? null})
    returning id
  `;
  return inserted[0].id;
}

async function ensureMajorLead(sql, majorId, userId) {
  await sql`
    insert into public.major_leads (major_id, user_id)
    values (${majorId}::uuid, ${userId}::uuid)
    on conflict do nothing
  `;
}

async function ensureCourseResource(sql, params) {
  const rows = await sql`
    select id
    from public.course_resources
    where course_id = ${params.courseId}::uuid
      and resource_type = 'link'
      and link_url_normalized = ${params.linkUrlNormalized}
      and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.course_resources
      set major_id = ${params.majorId}::uuid,
          title = ${params.title},
          description = ${params.description},
          status = ${params.status},
          link_url = ${params.linkUrl},
          link_url_normalized = ${params.linkUrlNormalized},
          submitted_at = ${params.submittedAt ?? null},
          reviewed_by = ${params.reviewedBy ?? null}::uuid,
          reviewed_at = ${params.reviewedAt ?? null},
          review_comment = ${params.reviewComment ?? null},
          published_at = ${params.publishedAt ?? null},
          download_count = ${params.downloadCount},
          last_download_at = ${params.lastDownloadAt ?? null},
          updated_by = ${params.updatedBy ?? null}::uuid,
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.course_resources (
      major_id, course_id,
      title, description,
      resource_type, status,
      link_url, link_url_normalized,
      submitted_at,
      reviewed_by, reviewed_at, review_comment,
      published_at,
      download_count, last_download_at,
      created_by, updated_by
    )
    values (
      ${params.majorId}::uuid, ${params.courseId}::uuid,
      ${params.title}, ${params.description},
      'link', ${params.status},
      ${params.linkUrl}, ${params.linkUrlNormalized},
      ${params.submittedAt ?? null},
      ${params.reviewedBy ?? null}::uuid, ${params.reviewedAt ?? null}, ${params.reviewComment ?? null},
      ${params.publishedAt ?? null},
      ${params.downloadCount}, ${params.lastDownloadAt ?? null},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function upsertCourseResourceBest(sql, resourceId, bestBy, bestAt) {
  await sql`
    insert into public.course_resource_bests (resource_id, best_by, best_at)
    values (${resourceId}::uuid, ${bestBy}::uuid, ${bestAt})
    on conflict (resource_id) do update
    set best_by = excluded.best_by, best_at = excluded.best_at
  `;
}

async function deleteDemoCourseResourceDownloadEvents(sql, resourceId) {
  await sql`
    delete from public.course_resource_download_events
    where resource_id = ${resourceId}::uuid and user_agent = ${DEMO_USER_AGENT}
  `;
}

async function insertCourseResourceDownloadEvents(sql, params) {
  for (const occurredAt of params.occurredAtList) {
    await sql`
      insert into public.course_resource_download_events (resource_id, user_id, occurred_at, ip, user_agent)
      values (${params.resourceId}::uuid, ${params.userId ?? null}::uuid, ${occurredAt}, ${params.ip ?? null}, ${DEMO_USER_AGENT})
    `;
  }
}

async function upsertCourseResourceScoreEvent(sql, params) {
  await sql`
    insert into public.course_resource_score_events (user_id, major_id, resource_id, event_type, delta, occurred_at)
    values (${params.userId}::uuid, ${params.majorId}::uuid, ${params.resourceId}::uuid, ${params.eventType}, ${params.delta}, ${params.occurredAt})
    on conflict (user_id, resource_id, event_type) do nothing
  `;
}

async function ensureFacilityBuilding(sql, params) {
  const rows = await sql`
    select id
    from public.facility_buildings
    where name = ${params.name} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.facility_buildings
      set enabled = ${params.enabled}, sort = ${params.sort}, remark = ${params.remark ?? null}
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.facility_buildings (name, enabled, sort, remark)
    values (${params.name}, ${params.enabled}, ${params.sort}, ${params.remark ?? null})
    returning id
  `;
  return inserted[0].id;
}

async function ensureFacilityRoom(sql, params) {
  const rows = await sql`
    select id
    from public.facility_rooms
    where building_id = ${params.buildingId}::uuid
      and floor_no = ${params.floorNo}
      and name = ${params.name}
      and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.facility_rooms
      set capacity = ${params.capacity ?? null},
          enabled = ${params.enabled},
          sort = ${params.sort},
          remark = ${params.remark ?? null}
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.facility_rooms (building_id, floor_no, name, capacity, enabled, sort, remark)
    values (${params.buildingId}::uuid, ${params.floorNo}, ${params.name}, ${params.capacity ?? null}, ${params.enabled}, ${params.sort}, ${params.remark ?? null})
    returning id
  `;
  return inserted[0].id;
}

async function deleteDemoFacilityReservations(sql) {
  await sql`
    delete from public.facility_reservations
    where purpose like ${`${DEMO_TITLE_PREFIX}%`}
  `;
}

async function insertFacilityReservation(sql, params) {
  const inserted = await sql`
    insert into public.facility_reservations (
      room_id, applicant_id, purpose,
      start_at, end_at, status,
      reviewed_by, reviewed_at, reject_reason,
      cancelled_by, cancelled_at, cancel_reason,
      created_by, updated_by
    )
    values (
      ${params.roomId}::uuid, ${params.applicantId}::uuid, ${params.purpose},
      ${params.startAt}, ${params.endAt}, ${params.status},
      ${params.reviewedBy ?? null}::uuid, ${params.reviewedAt ?? null}, ${params.rejectReason ?? null},
      ${params.cancelledBy ?? null}::uuid, ${params.cancelledAt ?? null}, ${params.cancelReason ?? null},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function insertFacilityParticipants(sql, reservationId, participants) {
  for (const p of participants) {
    await sql`
      insert into public.facility_reservation_participants (reservation_id, user_id, is_applicant)
      values (${reservationId}::uuid, ${p.userId}::uuid, ${p.isApplicant})
      on conflict do nothing
    `;
  }
}

async function ensureLibraryBook(sql, params) {
  const rows = await sql`
    select id
    from public.library_books
    where isbn13 = ${params.isbn13} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.library_books
      set title = ${params.title},
          author = ${params.author},
          summary = ${params.summary ?? null},
          keywords = ${params.keywords ?? null},
          status = ${params.status},
          submitted_at = ${params.submittedAt ?? null},
          reviewed_by = ${params.reviewedBy ?? null}::uuid,
          reviewed_at = ${params.reviewedAt ?? null},
          review_comment = ${params.reviewComment ?? null},
          published_at = ${params.publishedAt ?? null},
          download_count = ${params.downloadCount},
          last_download_at = ${params.lastDownloadAt ?? null},
          updated_by = ${params.updatedBy ?? null}::uuid,
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.library_books (
      isbn13, title, author, summary, keywords,
      status, submitted_at,
      reviewed_by, reviewed_at, review_comment,
      published_at,
      download_count, last_download_at,
      created_by, updated_by
    )
    values (
      ${params.isbn13}, ${params.title}, ${params.author}, ${params.summary ?? null}, ${params.keywords ?? null},
      ${params.status}, ${params.submittedAt ?? null},
      ${params.reviewedBy ?? null}::uuid, ${params.reviewedAt ?? null}, ${params.reviewComment ?? null},
      ${params.publishedAt ?? null},
      ${params.downloadCount}, ${params.lastDownloadAt ?? null},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function ensureLibraryLinkAsset(sql, params) {
  const rows = await sql`
    select id
    from public.library_book_assets
    where book_id = ${params.bookId}::uuid
      and asset_type = 'link'
      and link_url_normalized = ${params.linkUrlNormalized}
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.library_book_assets
      set link_url = ${params.linkUrl},
          link_url_normalized = ${params.linkUrlNormalized},
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.library_book_assets (book_id, asset_type, link_url, link_url_normalized, created_by)
    values (${params.bookId}::uuid, 'link', ${params.linkUrl}, ${params.linkUrlNormalized}, ${params.createdBy}::uuid)
    returning id
  `;
  return inserted[0].id;
}

async function ensureLibraryFavorite(sql, bookId, userId) {
  await sql`
    insert into public.library_book_favorites (book_id, user_id)
    values (${bookId}::uuid, ${userId}::uuid)
    on conflict do nothing
  `;
}

async function deleteDemoLibraryDownloadEvents(sql, bookId) {
  await sql`
    delete from public.library_book_download_events
    where book_id = ${bookId}::uuid and user_agent = ${DEMO_USER_AGENT}
  `;
}

async function insertLibraryDownloadEvents(sql, params) {
  for (const occurredAt of params.occurredAtList) {
    await sql`
      insert into public.library_book_download_events (book_id, asset_id, user_id, occurred_at, ip, user_agent)
      values (${params.bookId}::uuid, ${params.assetId}::uuid, ${params.userId ?? null}::uuid, ${occurredAt}, ${params.ip ?? null}, ${DEMO_USER_AGENT})
    `;
  }
}

async function ensureLostfoundItem(sql, params) {
  const rows = await sql`
    select id
    from public.lostfound_items
    where title = ${params.title} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.lostfound_items
      set type = ${params.type},
          content = ${params.content},
          location = ${params.location ?? null},
          occurred_at = ${params.occurredAt ?? null},
          contact_info = ${params.contactInfo ?? null},
          status = ${params.status},
          publish_at = ${params.publishAt ?? null},
          solved_at = ${params.solvedAt ?? null},
          reviewed_by = ${params.reviewedBy ?? null}::uuid,
          reviewed_at = ${params.reviewedAt ?? null},
          updated_by = ${params.updatedBy ?? null}::uuid,
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.lostfound_items (
      type, title, content, location, occurred_at, contact_info,
      status, publish_at, solved_at,
      reviewed_by, reviewed_at,
      created_by, updated_by
    )
    values (
      ${params.type}, ${params.title}, ${params.content}, ${params.location ?? null}, ${params.occurredAt ?? null}, ${params.contactInfo ?? null},
      ${params.status}, ${params.publishAt ?? null}, ${params.solvedAt ?? null},
      ${params.reviewedBy ?? null}::uuid, ${params.reviewedAt ?? null},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function ensureSurvey(sql, params) {
  const rows = await sql`
    select id
    from public.surveys
    where title = ${params.title} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.surveys
      set description_md = ${params.descriptionMd},
          status = ${params.status},
          start_at = ${params.startAt},
          end_at = ${params.endAt},
          anonymous_responses = ${params.anonymousResponses},
          visible_all = ${params.visibleAll},
          updated_by = ${params.updatedBy ?? null}::uuid,
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.surveys (
      title, description_md, status,
      start_at, end_at,
      anonymous_responses, visible_all,
      created_by, updated_by
    )
    values (
      ${params.title}, ${params.descriptionMd}, ${params.status},
      ${params.startAt}, ${params.endAt},
      ${params.anonymousResponses}, ${params.visibleAll},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function ensureSurveySection(sql, params) {
  const rows = await sql`
    select id
    from public.survey_sections
    where survey_id = ${params.surveyId}::uuid and title = ${params.title}
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`update public.survey_sections set sort = ${params.sort}, updated_at = now() where id = ${existingId}::uuid`;
    return existingId;
  }

  const inserted = await sql`
    insert into public.survey_sections (survey_id, title, sort)
    values (${params.surveyId}::uuid, ${params.title}, ${params.sort})
    returning id
  `;
  return inserted[0].id;
}

async function ensureSurveyQuestion(sql, params) {
  const rows = await sql`
    select id
    from public.survey_questions
    where survey_id = ${params.surveyId}::uuid and section_id = ${params.sectionId}::uuid and title = ${params.title}
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.survey_questions
      set question_type = ${params.questionType},
          description = ${params.description ?? null},
          required = ${params.required},
          sort = ${params.sort},
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.survey_questions (survey_id, section_id, question_type, title, description, required, sort)
    values (${params.surveyId}::uuid, ${params.sectionId}::uuid, ${params.questionType}, ${params.title}, ${params.description ?? null}, ${params.required}, ${params.sort})
    returning id
  `;
  return inserted[0].id;
}

async function ensureSurveyOption(sql, params) {
  const rows = await sql`
    select id
    from public.survey_question_options
    where question_id = ${params.questionId}::uuid and label = ${params.label}
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`update public.survey_question_options set sort = ${params.sort} where id = ${existingId}::uuid`;
    return existingId;
  }

  const inserted = await sql`
    insert into public.survey_question_options (question_id, label, sort)
    values (${params.questionId}::uuid, ${params.label}, ${params.sort})
    returning id
  `;
  return inserted[0].id;
}

async function ensureSurveyResponse(sql, params) {
  const rows = await sql`
    select id
    from public.survey_responses
    where survey_id = ${params.surveyId}::uuid and user_id = ${params.userId}::uuid
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) return existingId;

  const inserted = await sql`
    insert into public.survey_responses (survey_id, user_id)
    values (${params.surveyId}::uuid, ${params.userId}::uuid)
    returning id
  `;
  return inserted[0].id;
}

async function upsertSurveyResponseItem(sql, params) {
  await sql`
    insert into public.survey_response_items (response_id, question_id, value)
    values (${params.responseId}::uuid, ${params.questionId}::uuid, ${JSON.stringify(params.value)}::jsonb)
    on conflict (response_id, question_id) do update
    set value = excluded.value
  `;
}

async function ensureVote(sql, params) {
  const rows = await sql`
    select id
    from public.votes
    where title = ${params.title} and deleted_at is null
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.votes
      set description_md = ${params.descriptionMd},
          status = ${params.status},
          start_at = ${params.startAt},
          end_at = ${params.endAt},
          anonymous_responses = ${params.anonymousResponses},
          visible_all = ${params.visibleAll},
          pinned = ${params.pinned},
          pinned_at = ${params.pinnedAt ?? null},
          updated_by = ${params.updatedBy ?? null}::uuid,
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.votes (
      title, description_md, status,
      start_at, end_at,
      anonymous_responses, visible_all,
      pinned, pinned_at,
      created_by, updated_by
    )
    values (
      ${params.title}, ${params.descriptionMd}, ${params.status},
      ${params.startAt}, ${params.endAt},
      ${params.anonymousResponses}, ${params.visibleAll},
      ${params.pinned}, ${params.pinnedAt ?? null},
      ${params.createdBy}::uuid, ${params.updatedBy ?? null}::uuid
    )
    returning id
  `;
  return inserted[0].id;
}

async function ensureVoteQuestion(sql, params) {
  const rows = await sql`
    select id
    from public.vote_questions
    where vote_id = ${params.voteId}::uuid and title = ${params.title}
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`
      update public.vote_questions
      set question_type = ${params.questionType},
          description = ${params.description ?? null},
          required = ${params.required},
          sort = ${params.sort},
          max_choices = ${params.maxChoices},
          updated_at = now()
      where id = ${existingId}::uuid
    `;
    return existingId;
  }

  const inserted = await sql`
    insert into public.vote_questions (vote_id, question_type, title, description, required, sort, max_choices)
    values (${params.voteId}::uuid, ${params.questionType}, ${params.title}, ${params.description ?? null}, ${params.required}, ${params.sort}, ${params.maxChoices})
    returning id
  `;
  return inserted[0].id;
}

async function ensureVoteOption(sql, params) {
  const rows = await sql`
    select id
    from public.vote_question_options
    where question_id = ${params.questionId}::uuid and label = ${params.label}
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) {
    await sql`update public.vote_question_options set sort = ${params.sort} where id = ${existingId}::uuid`;
    return existingId;
  }

  const inserted = await sql`
    insert into public.vote_question_options (question_id, label, sort)
    values (${params.questionId}::uuid, ${params.label}, ${params.sort})
    returning id
  `;
  return inserted[0].id;
}

async function ensureVoteResponse(sql, params) {
  const rows = await sql`
    select id
    from public.vote_responses
    where vote_id = ${params.voteId}::uuid and user_id = ${params.userId}::uuid
    limit 1
  `;
  const existingId = rows[0]?.id;
  if (existingId) return existingId;

  const inserted = await sql`
    insert into public.vote_responses (vote_id, user_id)
    values (${params.voteId}::uuid, ${params.userId}::uuid)
    returning id
  `;
  return inserted[0].id;
}

async function upsertVoteResponseItem(sql, params) {
  await sql`
    insert into public.vote_response_items (response_id, question_id, value)
    values (${params.responseId}::uuid, ${params.questionId}::uuid, ${JSON.stringify(params.value)}::jsonb)
    on conflict (response_id, question_id) do update
    set value = excluded.value
  `;
}

async function seed() {
  loadEnv();

  const databaseUrl = requireEnv("DATABASE_URL");
  const sql = postgres(databaseUrl, { prepare: false, max: 5 });

  try {
    logSection("预检");
    await assertSchemaReady(sql);
    console.log("数据库结构检查：OK");

    logSection("演示账号");
    const supabase = createSupabaseAdminClient();
    const password = process.env.DEMO_PASSWORD?.trim() || "CampusHub123!";

    const demoUsers = [
      {
        key: "superAdmin",
        email: process.env.DEMO_SUPER_ADMIN_EMAIL?.trim() || "super_admin@campus-hub.test",
        name: "演示超管",
        studentId: "2025000000000001",
        roles: ["super_admin"],
      },
      {
        key: "staff",
        email: process.env.DEMO_STAFF_EMAIL?.trim() || "staff@campus-hub.test",
        name: "演示运营",
        studentId: "2025000000000002",
        roles: ["staff", "major_lead", "librarian"],
      },
      {
        key: "user1",
        email: process.env.DEMO_USER1_EMAIL?.trim() || "user1@campus-hub.test",
        name: "演示学生甲",
        studentId: "2025000000000003",
        roles: [],
      },
      {
        key: "user2",
        email: process.env.DEMO_USER2_EMAIL?.trim() || "user2@campus-hub.test",
        name: "演示学生乙",
        studentId: "2025000000000004",
        roles: [],
      },
    ];

    const userByKey = new Map();
    for (const u of demoUsers) {
      const user = await ensureAuthUser(supabase, { ...u, password });
      userByKey.set(u.key, user);
      console.log(`- ${u.key}: ${u.email} (${user.id})`);
    }

    const superAdmin = userByKey.get("superAdmin");
    const staff = userByKey.get("staff");
    const user1 = userByKey.get("user1");
    const user2 = userByKey.get("user2");

    await sql.begin(async (tx) => {
      for (const u of demoUsers) {
        const user = userByKey.get(u.key);
        await forceProfileActive(tx, user.id);
        for (const role of u.roles) await ensureUserRole(tx, user.id, role);
      }
    });

    console.log(`默认密码：${password}（可用 DEMO_PASSWORD 覆盖）`);

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const oneHourMs = 60 * 60 * 1000;

    logSection("组织与岗位");
    await sql.begin(async (tx) => {
      const deptEngineering = await ensureDepartment(tx, { name: `${DEMO_NAME_PREFIX}信息工程学院`, parentId: null, sort: 10 });
      const deptCs = await ensureDepartment(tx, { name: `${DEMO_NAME_PREFIX}计算机系`, parentId: deptEngineering, sort: 20 });
      const deptLibrary = await ensureDepartment(tx, { name: `${DEMO_NAME_PREFIX}图书馆`, parentId: null, sort: 30 });

      const posStudent = await ensurePosition(tx, {
        code: "DEMO_STU",
        name: `${DEMO_NAME_PREFIX}学生`,
        description: "演示：普通学生岗位",
        enabled: true,
        sort: 10,
      });
      const posStaff = await ensurePosition(tx, {
        code: "DEMO_STAFF",
        name: `${DEMO_NAME_PREFIX}运营`,
        description: "演示：模块运营/审核",
        enabled: true,
        sort: 20,
      });
      const posLibrarian = await ensurePosition(tx, {
        code: "DEMO_LIB",
        name: `${DEMO_NAME_PREFIX}图书管理员`,
        description: "演示：数字图书馆审核",
        enabled: true,
        sort: 30,
      });

      await ensureUserDepartment(tx, staff.id, deptCs);
      await ensureUserDepartment(tx, user1.id, deptCs);
      await ensureUserDepartment(tx, user2.id, deptCs);
      await ensureUserDepartment(tx, superAdmin.id, deptLibrary);

      await ensureUserPosition(tx, staff.id, posStaff);
      await ensureUserPosition(tx, staff.id, posLibrarian);
      await ensureUserPosition(tx, user1.id, posStudent);
      await ensureUserPosition(tx, user2.id, posStudent);
    });
    console.log("部门/岗位/用户归属：OK");

    logSection("通知公告");
    await sql.begin(async (tx) => {
      const notice1 = await ensureNotice(tx, {
        title: `${DEMO_TITLE_PREFIX}平台试运行公告`,
        contentMd: [
          "# 平台试运行",
          "",
          "- 入口：`/`（Portal）与 `/console`（管理端）",
          "- 本公告为演示数据（可用 `pnpm demo:reset` 清理）",
          "",
          "如遇问题请在 issue 中反馈。",
        ].join("\n"),
        status: "published",
        visibleAll: true,
        pinned: true,
        pinnedAt: now,
        publishAt: now,
        expireAt: null,
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      await ensureNotice(tx, {
        title: `${DEMO_TITLE_PREFIX}关于期末周自习室预约的说明`,
        contentMd: [
          "本周起开放功能房预约（演示数据）：",
          "",
          "1. 选择楼房与楼层",
          "2. 查看房间时间轴",
          "3. 提交预约（可能需要审核）",
        ].join("\n"),
        status: "published",
        visibleAll: true,
        pinned: false,
        pinnedAt: null,
        publishAt: new Date(now.getTime() - dayMs),
        expireAt: null,
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      await ensureNotice(tx, {
        title: `${DEMO_TITLE_PREFIX}数字图书馆资源征集`,
        contentMd: [
          "欢迎同学们投稿电子书资源（PDF/EPUB/外链）。",
          "",
          "- 入口：`/library/me/new`",
          "- 审核通过后会在 `/library` 展示",
        ].join("\n"),
        status: "published",
        visibleAll: true,
        pinned: false,
        pinnedAt: null,
        publishAt: new Date(now.getTime() - 2 * dayMs),
        expireAt: null,
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      await ensureNoticeRead(tx, notice1, user1.id, new Date(now.getTime() - 2 * oneHourMs));
    });
    console.log("公告：OK");

    logSection("课程资源分享");
    await sql.begin(async (tx) => {
      const majorCs = await ensureMajor(tx, { name: `${DEMO_NAME_PREFIX}计算机科学与技术`, enabled: true, sort: 10, remark: "演示专业" });
      const majorSe = await ensureMajor(tx, { name: `${DEMO_NAME_PREFIX}软件工程`, enabled: true, sort: 20, remark: "演示专业" });

      await ensureMajorLead(tx, majorCs, staff.id);
      await ensureMajorLead(tx, majorSe, staff.id);

      const courseDs = await ensureCourse(tx, { majorId: majorCs, name: "数据结构", code: "CS101", enabled: true, sort: 10, remark: "演示课程" });
      const courseOs = await ensureCourse(tx, { majorId: majorCs, name: "操作系统", code: "CS201", enabled: true, sort: 20, remark: "演示课程" });
      const courseWeb = await ensureCourse(tx, { majorId: majorSe, name: "Web 开发", code: "SE101", enabled: true, sort: 10, remark: "演示课程" });
      const courseDb = await ensureCourse(tx, { majorId: majorSe, name: "数据库系统", code: "SE201", enabled: true, sort: 20, remark: "演示课程" });

      const resourceAUrl = "https://csdiy.wiki/";
      const resourceBUrl = "https://missing.csail.mit.edu/";
      const resourceCUrl = "https://roadmap.sh/";
      const resourceDUrl = "https://developer.mozilla.org/zh-CN/";

      const rA = await ensureCourseResource(tx, {
        majorId: majorCs,
        courseId: courseDs,
        title: `${DEMO_TITLE_PREFIX}CS 自学指南（汇总）`,
        description: "适合入门与扩展阅读的资源索引（演示数据）",
        status: "published",
        linkUrl: resourceAUrl,
        linkUrlNormalized: normalizeExternalUrl(resourceAUrl),
        submittedAt: new Date(now.getTime() - 10 * dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 9 * dayMs),
        reviewComment: "通过（演示）",
        publishedAt: new Date(now.getTime() - 9 * dayMs),
        downloadCount: 12,
        lastDownloadAt: new Date(now.getTime() - 2 * oneHourMs),
        createdBy: user1.id,
        updatedBy: staff.id,
      });

      const rB = await ensureCourseResource(tx, {
        majorId: majorCs,
        courseId: courseOs,
        title: `${DEMO_TITLE_PREFIX}MIT 缺失的一课`,
        description: "面向开发者的工具/工程实践课程（演示数据）",
        status: "published",
        linkUrl: resourceBUrl,
        linkUrlNormalized: normalizeExternalUrl(resourceBUrl),
        submittedAt: new Date(now.getTime() - 8 * dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 7 * dayMs),
        reviewComment: "通过（演示）",
        publishedAt: new Date(now.getTime() - 7 * dayMs),
        downloadCount: 7,
        lastDownloadAt: new Date(now.getTime() - 3 * oneHourMs),
        createdBy: user2.id,
        updatedBy: staff.id,
      });

      const rC = await ensureCourseResource(tx, {
        majorId: majorSe,
        courseId: courseWeb,
        title: `${DEMO_TITLE_PREFIX}开发路线图`,
        description: "前端/后端/DevOps 等路线图（演示数据）",
        status: "published",
        linkUrl: resourceCUrl,
        linkUrlNormalized: normalizeExternalUrl(resourceCUrl),
        submittedAt: new Date(now.getTime() - 6 * dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 5 * dayMs),
        reviewComment: "通过（演示）",
        publishedAt: new Date(now.getTime() - 5 * dayMs),
        downloadCount: 4,
        lastDownloadAt: new Date(now.getTime() - 5 * oneHourMs),
        createdBy: user1.id,
        updatedBy: staff.id,
      });

      await ensureCourseResource(tx, {
        majorId: majorSe,
        courseId: courseDb,
        title: `${DEMO_TITLE_PREFIX}MDN 参考手册`,
        description: "Web 标准文档入口（演示数据）",
        status: "published",
        linkUrl: resourceDUrl,
        linkUrlNormalized: normalizeExternalUrl(resourceDUrl),
        submittedAt: new Date(now.getTime() - 4 * dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 3 * dayMs),
        reviewComment: "通过（演示）",
        publishedAt: new Date(now.getTime() - 3 * dayMs),
        downloadCount: 2,
        lastDownloadAt: new Date(now.getTime() - 8 * oneHourMs),
        createdBy: user2.id,
        updatedBy: staff.id,
      });

      await upsertCourseResourceBest(tx, rA, staff.id, new Date(now.getTime() - dayMs));

      // 清理并重建 demo 下载事件（保证重复执行不累加）
      for (const resourceId of [rA, rB, rC]) await deleteDemoCourseResourceDownloadEvents(tx, resourceId);

      const makeEvents = (count) =>
        Array.from({ length: count }, (_, i) => new Date(now.getTime() - (i + 1) * oneHourMs));

      await insertCourseResourceDownloadEvents(tx, { resourceId: rA, userId: user1.id, ip: "127.0.0.1", occurredAtList: makeEvents(6) });
      await insertCourseResourceDownloadEvents(tx, { resourceId: rA, userId: user2.id, ip: "127.0.0.1", occurredAtList: makeEvents(6) });
      await insertCourseResourceDownloadEvents(tx, { resourceId: rB, userId: user1.id, ip: "127.0.0.1", occurredAtList: makeEvents(4) });
      await insertCourseResourceDownloadEvents(tx, { resourceId: rC, userId: user2.id, ip: "127.0.0.1", occurredAtList: makeEvents(3) });

      // 积分事件：approve/best（唯一约束保证幂等）
      await upsertCourseResourceScoreEvent(tx, { userId: user1.id, majorId: majorCs, resourceId: rA, eventType: "approve", delta: 5, occurredAt: now });
      await upsertCourseResourceScoreEvent(tx, { userId: user2.id, majorId: majorCs, resourceId: rB, eventType: "approve", delta: 5, occurredAt: now });
      await upsertCourseResourceScoreEvent(tx, { userId: user1.id, majorId: majorCs, resourceId: rA, eventType: "best", delta: 10, occurredAt: now });
    });
    console.log("课程资源：OK（含榜单/积分 demo 数据）");

    logSection("功能房预约");
    await sql.begin(async (tx) => {
      const building = await ensureFacilityBuilding(tx, {
        name: `${DEMO_NAME_PREFIX}1号楼`,
        enabled: true,
        sort: 10,
        remark: "演示楼房（用于功能房预约）",
      });

      const room101 = await ensureFacilityRoom(tx, { buildingId: building, floorNo: 1, name: "101 自习室", capacity: 40, enabled: true, sort: 10, remark: null });
      const room102 = await ensureFacilityRoom(tx, { buildingId: building, floorNo: 1, name: "102 讨论室", capacity: 12, enabled: true, sort: 20, remark: null });
      const room201 = await ensureFacilityRoom(tx, { buildingId: building, floorNo: 2, name: "201 机房", capacity: 30, enabled: true, sort: 10, remark: null });
      await ensureFacilityRoom(tx, { buildingId: building, floorNo: 2, name: "202 会议室", capacity: 16, enabled: true, sort: 20, remark: null });

      await deleteDemoFacilityReservations(tx);

      const today = new Date(now);
      today.setMinutes(0, 0, 0);

      const approvedStart = new Date(today.getTime() + 2 * oneHourMs);
      const approvedEnd = new Date(today.getTime() + 4 * oneHourMs);
      const pendingStart = new Date(today.getTime() + 5 * oneHourMs);
      const pendingEnd = new Date(today.getTime() + 6 * oneHourMs);

      const approvedId = await insertFacilityReservation(tx, {
        roomId: room101,
        applicantId: user1.id,
        purpose: `${DEMO_TITLE_PREFIX}期末复习自习`,
        startAt: approvedStart,
        endAt: approvedEnd,
        status: "approved",
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - oneHourMs),
        createdBy: user1.id,
        updatedBy: staff.id,
      });
      await insertFacilityParticipants(tx, approvedId, [
        { userId: user1.id, isApplicant: true },
        { userId: user2.id, isApplicant: false },
      ]);

      const pendingId = await insertFacilityReservation(tx, {
        roomId: room102,
        applicantId: user2.id,
        purpose: `${DEMO_TITLE_PREFIX}小组讨论`,
        startAt: pendingStart,
        endAt: pendingEnd,
        status: "pending",
        createdBy: user2.id,
        updatedBy: null,
      });
      await insertFacilityParticipants(tx, pendingId, [{ userId: user2.id, isApplicant: true }]);

      // 额外：给 /rooms/[id]/timeline 留一个历史占用
      const historyStart = new Date(now.getTime() - 3 * dayMs);
      const historyEnd = new Date(now.getTime() - 3 * dayMs + 2 * oneHourMs);
      const historyId = await insertFacilityReservation(tx, {
        roomId: room201,
        applicantId: user1.id,
        purpose: `${DEMO_TITLE_PREFIX}课程实验`,
        startAt: historyStart,
        endAt: historyEnd,
        status: "approved",
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 3 * dayMs + oneHourMs),
        createdBy: user1.id,
        updatedBy: staff.id,
      });
      await insertFacilityParticipants(tx, historyId, [{ userId: user1.id, isApplicant: true }]);
    });
    console.log("功能房：OK（含预约 demo 数据）");

    logSection("数字图书馆");
    await sql.begin(async (tx) => {
      const book1 = await ensureLibraryBook(tx, {
        isbn13: "9787111128069",
        title: `${DEMO_TITLE_PREFIX}代码大全（演示条目）`,
        author: "Steve McConnell",
        summary: "经典软件工程实践（演示数据）",
        keywords: "software-engineering, demo",
        status: "published",
        submittedAt: new Date(now.getTime() - 15 * dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 14 * dayMs),
        reviewComment: "通过（演示）",
        publishedAt: new Date(now.getTime() - 14 * dayMs),
        downloadCount: 9,
        lastDownloadAt: new Date(now.getTime() - 4 * oneHourMs),
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      const link1 = "https://www.example.com/demo-books/code-complete";
      const asset1 = await ensureLibraryLinkAsset(tx, {
        bookId: book1,
        linkUrl: link1,
        linkUrlNormalized: normalizeExternalUrl(link1),
        createdBy: staff.id,
      });

      const book2 = await ensureLibraryBook(tx, {
        isbn13: "9787111213826",
        title: `${DEMO_TITLE_PREFIX}重构（演示条目）`,
        author: "Martin Fowler",
        summary: "让代码更易维护（演示数据）",
        keywords: "refactoring, demo",
        status: "published",
        submittedAt: new Date(now.getTime() - 12 * dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 11 * dayMs),
        reviewComment: "通过（演示）",
        publishedAt: new Date(now.getTime() - 11 * dayMs),
        downloadCount: 5,
        lastDownloadAt: new Date(now.getTime() - 6 * oneHourMs),
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      const link2 = "https://www.example.com/demo-books/refactoring";
      const asset2 = await ensureLibraryLinkAsset(tx, {
        bookId: book2,
        linkUrl: link2,
        linkUrlNormalized: normalizeExternalUrl(link2),
        createdBy: staff.id,
      });

      await ensureLibraryFavorite(tx, book1, user1.id);
      await ensureLibraryFavorite(tx, book2, user2.id);

      // 清理并重建 demo 下载事件（保证重复执行不累加）
      for (const bookId of [book1, book2]) await deleteDemoLibraryDownloadEvents(tx, bookId);

      const makeEvents = (count) =>
        Array.from({ length: count }, (_, i) => new Date(now.getTime() - (i + 1) * oneHourMs));

      await insertLibraryDownloadEvents(tx, { bookId: book1, assetId: asset1, userId: user1.id, ip: "127.0.0.1", occurredAtList: makeEvents(4) });
      await insertLibraryDownloadEvents(tx, { bookId: book1, assetId: asset1, userId: user2.id, ip: "127.0.0.1", occurredAtList: makeEvents(3) });
      await insertLibraryDownloadEvents(tx, { bookId: book2, assetId: asset2, userId: user1.id, ip: "127.0.0.1", occurredAtList: makeEvents(2) });
    });
    console.log("图书馆：OK（含榜单 demo 数据）");

    logSection("失物招领");
    await sql.begin(async (tx) => {
      await ensureLostfoundItem(tx, {
        title: `${DEMO_TITLE_PREFIX}丢失校园卡`,
        type: "lost",
        content: "在食堂附近遗失校园卡一张，卡套为透明色。拾到请联系我。",
        location: "一食堂门口",
        occurredAt: new Date(now.getTime() - 2 * dayMs),
        contactInfo: "QQ：12345678",
        status: "published",
        publishAt: new Date(now.getTime() - 2 * dayMs),
        solvedAt: null,
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 2 * dayMs + oneHourMs),
        createdBy: user1.id,
        updatedBy: staff.id,
      });

      await ensureLostfoundItem(tx, {
        title: `${DEMO_TITLE_PREFIX}拾到U盘`,
        type: "found",
        content: "教学楼 2F 自习区座位上发现U盘一个，请失主私信核对内容后领取。",
        location: "教学楼 2F",
        occurredAt: new Date(now.getTime() - 3 * dayMs),
        contactInfo: "邮箱：user2@campus-hub.test",
        status: "published",
        publishAt: new Date(now.getTime() - 3 * dayMs),
        solvedAt: new Date(now.getTime() - dayMs),
        reviewedBy: staff.id,
        reviewedAt: new Date(now.getTime() - 3 * dayMs + oneHourMs),
        createdBy: user2.id,
        updatedBy: staff.id,
      });
    });
    console.log("失物招领：OK");

    logSection("问卷");
    await sql.begin(async (tx) => {
      const survey = await ensureSurvey(tx, {
        title: `${DEMO_TITLE_PREFIX}食堂满意度问卷`,
        descriptionMd: "用于收集同学们对食堂的反馈（演示数据）",
        status: "published",
        startAt: new Date(now.getTime() - 5 * dayMs),
        endAt: new Date(now.getTime() + 10 * dayMs),
        anonymousResponses: false,
        visibleAll: true,
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      const section = await ensureSurveySection(tx, { surveyId: survey, title: "基础问题", sort: 10 });
      const qRating = await ensureSurveyQuestion(tx, { surveyId: survey, sectionId: section, questionType: "rating", title: "总体满意度（1-5）", description: null, required: true, sort: 10 });
      const qSingle = await ensureSurveyQuestion(tx, { surveyId: survey, sectionId: section, questionType: "single", title: "最常去的食堂是？", description: null, required: true, sort: 20 });
      const qText = await ensureSurveyQuestion(tx, { surveyId: survey, sectionId: section, questionType: "text", title: "你最希望改进的点是什么？", description: null, required: false, sort: 30 });

      const optA = await ensureSurveyOption(tx, { questionId: qSingle, label: "一食堂", sort: 10 });
      const optB = await ensureSurveyOption(tx, { questionId: qSingle, label: "二食堂", sort: 20 });

      const r1 = await ensureSurveyResponse(tx, { surveyId: survey, userId: user1.id });
      await upsertSurveyResponseItem(tx, { responseId: r1, questionId: qRating, value: { value: 4 } });
      await upsertSurveyResponseItem(tx, { responseId: r1, questionId: qSingle, value: { optionId: optA } });
      await upsertSurveyResponseItem(tx, { responseId: r1, questionId: qText, value: { text: "希望排队速度更快一些。" } });

      const r2 = await ensureSurveyResponse(tx, { surveyId: survey, userId: user2.id });
      await upsertSurveyResponseItem(tx, { responseId: r2, questionId: qRating, value: { value: 3 } });
      await upsertSurveyResponseItem(tx, { responseId: r2, questionId: qSingle, value: { optionId: optB } });
      await upsertSurveyResponseItem(tx, { responseId: r2, questionId: qText, value: { text: "增加更多清淡选项。" } });
    });
    console.log("问卷：OK（含 2 份回收样例）");

    logSection("投票");
    await sql.begin(async (tx) => {
      const vote = await ensureVote(tx, {
        title: `${DEMO_TITLE_PREFIX}下学期社团活动投票`,
        descriptionMd: "请选择你最希望参与的活动方向（演示数据）",
        status: "published",
        startAt: new Date(now.getTime() - 2 * dayMs),
        endAt: new Date(now.getTime() + 7 * dayMs),
        anonymousResponses: false,
        visibleAll: true,
        pinned: true,
        pinnedAt: now,
        createdBy: staff.id,
        updatedBy: staff.id,
      });

      const q1 = await ensureVoteQuestion(tx, { voteId: vote, questionType: "single", title: "活动主题偏好", description: null, required: true, sort: 10, maxChoices: 1 });
      const c1 = await ensureVoteOption(tx, { questionId: q1, label: "技术分享", sort: 10 });
      const c2 = await ensureVoteOption(tx, { questionId: q1, label: "运动比赛", sort: 20 });
      const c3 = await ensureVoteOption(tx, { questionId: q1, label: "公益活动", sort: 30 });

      const r1 = await ensureVoteResponse(tx, { voteId: vote, userId: user1.id });
      await upsertVoteResponseItem(tx, { responseId: r1, questionId: q1, value: { optionId: c1 } });

      const r2 = await ensureVoteResponse(tx, { voteId: vote, userId: user2.id });
      await upsertVoteResponseItem(tx, { responseId: r2, questionId: q1, value: { optionId: c2 } });

      // 保持 c3 可选但暂未投，用于展示统计
      void c3;
    });
    console.log("投票：OK（含 2 票样例）");

    logSection("完成");
    console.log("演示数据已生成/补齐。你现在可以：");
    console.log("- `pnpm dev` 启动后访问 `/`、`/notices`、`/resources`、`/facilities`、`/library`、`/lostfound`、`/surveys`、`/votes`");
    console.log("- 使用 super_admin 账号登录进入 `/console` 查看管理端");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function reset() {
  loadEnv();

  const databaseUrl = requireEnv("DATABASE_URL");
  const sql = postgres(databaseUrl, { prepare: false, max: 5 });

  try {
    if (!isYes(process.env.DEMO_RESET_CONFIRM)) {
      throw new Error(
        [
          "⚠️ 危险操作检测！",
          "操作类型：删除演示数据（bulk delete）",
          "影响范围：删除由 demo-data 脚本生成的【DEMO】/DEMO· 前缀数据（不删除真实用户数据）",
          "风险评估：若你在演示账号下产生了真实数据，也可能被一并清理",
          "",
          "请确认是否继续？需要：DEMO_RESET_CONFIRM=YES",
        ].join("\n"),
      );
    }

    await assertSchemaReady(sql);

    logSection("定位演示账号");
    const demoEmails = [
      process.env.DEMO_SUPER_ADMIN_EMAIL?.trim() || "super_admin@campus-hub.test",
      process.env.DEMO_STAFF_EMAIL?.trim() || "staff@campus-hub.test",
      process.env.DEMO_USER1_EMAIL?.trim() || "user1@campus-hub.test",
      process.env.DEMO_USER2_EMAIL?.trim() || "user2@campus-hub.test",
    ];

    const authUserRows = await sql`
      select id, email
      from auth.users
      where lower(email) = any (${sql.array(demoEmails.map((e) => e.toLowerCase()))})
    `;
    const demoUserIds = authUserRows.map((r) => r.id);
    console.log(`演示账号数量：${demoUserIds.length}`);

    logSection("删除演示数据");
    await sql.begin(async (tx) => {
      // notices
      await tx`delete from public.notice_reads where notice_id in (select id from public.notices where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.notice_attachments where notice_id in (select id from public.notices where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.notice_scopes where notice_id in (select id from public.notices where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.notices where title like ${`${DEMO_TITLE_PREFIX}%`}`;

      // course resources
      await tx`delete from public.course_resource_download_events where user_agent = ${DEMO_USER_AGENT}`;
      await tx`delete from public.course_resource_bests where resource_id in (select id from public.course_resources where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.course_resource_score_events where resource_id in (select id from public.course_resources where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.course_resources where title like ${`${DEMO_TITLE_PREFIX}%`}`;
      await tx`
        delete from public.courses c
        using public.majors m
        where c.major_id = m.id
          and m.name like ${`${DEMO_NAME_PREFIX}%`}
      `;
      await tx`delete from public.majors where name like ${`${DEMO_NAME_PREFIX}%`}`;

      // facilities
      await tx`delete from public.facility_reservations where purpose like ${`${DEMO_TITLE_PREFIX}%`}`;
      await tx`delete from public.facility_rooms where building_id in (select id from public.facility_buildings where name like ${`${DEMO_NAME_PREFIX}%`})`;
      await tx`delete from public.facility_buildings where name like ${`${DEMO_NAME_PREFIX}%`}`;

      // library
      await tx`delete from public.library_book_download_events where user_agent = ${DEMO_USER_AGENT}`;
      await tx`delete from public.library_book_favorites where book_id in (select id from public.library_books where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.library_book_assets where book_id in (select id from public.library_books where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.library_books where title like ${`${DEMO_TITLE_PREFIX}%`}`;

      // lostfound
      await tx`delete from public.lostfound_item_images where item_id in (select id from public.lostfound_items where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.lostfound_items where title like ${`${DEMO_TITLE_PREFIX}%`}`;

      // surveys
      await tx`delete from public.survey_response_items where response_id in (select id from public.survey_responses where survey_id in (select id from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`}))`;
      await tx`delete from public.survey_responses where survey_id in (select id from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.survey_question_options where question_id in (select id from public.survey_questions where survey_id in (select id from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`}))`;
      await tx`delete from public.survey_questions where survey_id in (select id from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.survey_sections where survey_id in (select id from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.survey_scopes where survey_id in (select id from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.surveys where title like ${`${DEMO_TITLE_PREFIX}%`}`;

      // votes
      await tx`delete from public.vote_response_items where response_id in (select id from public.vote_responses where vote_id in (select id from public.votes where title like ${`${DEMO_TITLE_PREFIX}%`}))`;
      await tx`delete from public.vote_responses where vote_id in (select id from public.votes where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.vote_question_options where question_id in (select id from public.vote_questions where vote_id in (select id from public.votes where title like ${`${DEMO_TITLE_PREFIX}%`}))`;
      await tx`delete from public.vote_questions where vote_id in (select id from public.votes where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.vote_scopes where vote_id in (select id from public.votes where title like ${`${DEMO_TITLE_PREFIX}%`})`;
      await tx`delete from public.votes where title like ${`${DEMO_TITLE_PREFIX}%`}`;

      // org & positions (仅 demo 前缀)
      await tx`delete from public.user_positions where user_id = any (${tx.array(demoUserIds)}::uuid[])`;
      await tx`delete from public.user_departments where user_id = any (${tx.array(demoUserIds)}::uuid[])`;
      await tx`delete from public.positions where name like ${`${DEMO_NAME_PREFIX}%`}`;
      await tx`delete from public.departments where name like ${`${DEMO_NAME_PREFIX}%`}`;
    });

    console.log("演示数据已清理（演示账号仍保留）。");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const command = process.argv[2]?.trim();
  if (!command || (command !== "seed" && command !== "reset")) {
    console.log("用法：node scripts/demo-data.mjs <seed|reset>");
    process.exitCode = 1;
    return;
  }

  if (command === "seed") {
    await seed();
    return;
  }
  await reset();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
