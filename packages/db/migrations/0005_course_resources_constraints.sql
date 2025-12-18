-- 课程资源分享：修正草稿态约束（允许 draft 阶段暂不绑定 file/link 细节）
-- 背景：资源创建默认 draft；文件资源需要“先签名直传，再回填 file 元信息”；
--       外链资源也允许先存草稿，再补全链接并提交审核。
--
-- 说明：本迁移仅调整 CHECK 约束，不涉及破坏性数据操作。

alter table if exists public.course_resources
drop constraint if exists course_resources_file_or_link_chk;

alter table if exists public.course_resources
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

