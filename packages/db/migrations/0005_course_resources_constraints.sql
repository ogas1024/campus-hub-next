-- 课程资源分享：修正草稿态约束（允许 draft 阶段暂不绑定 file/link 细节）
-- 背景：资源创建默认 draft；文件资源需要“先签名直传，再回填 file 元信息”；
--       外链资源也允许先存草稿，再补全链接并提交审核。
--
-- 【0基础速读】
-- 0004 里初版约束要求 file/link 资源一创建就必须字段完整。
-- 但真实流程是：
-- - 文件资源：先创建草稿，再上传文件，上传成功后回填 file_bucket/file_key/sha256 等字段
-- - 外链资源：也可能先保存草稿，再补充链接
--
-- 所以这里替换 CHECK 约束：
-- - draft 草稿态：允许文件/链接明细暂时为空
-- - 非草稿流程：必须字段完整，且 file/link 字段不能混填
--
-- 说明：本迁移仅调整 CHECK 约束，不涉及破坏性数据操作。

alter table if exists public.course_resources
drop constraint if exists course_resources_file_or_link_chk;

-- 重新添加文件/外链字段组合约束。
alter table if exists public.course_resources
add constraint course_resources_file_or_link_chk check (
  (
    -- file 类型资源：不允许出现外链字段。
    resource_type = 'file'
    and link_url is null
    and link_url_normalized is null
    and (
      (
        -- file 草稿：允许文件字段暂时为空。
        status = 'draft'
        and file_bucket is null
        and file_key is null
        and file_name is null
        and file_size is null
        and sha256 is null
      )
      or
      (
        -- file 非草稿/已补全：文件字段必须完整。
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
    -- link 类型资源：不允许出现文件字段。
    resource_type = 'link'
    and file_bucket is null
    and file_key is null
    and file_name is null
    and file_size is null
    and sha256 is null
    and (
      (
        -- link 草稿：允许链接字段暂时为空。
        status = 'draft'
        and link_url is null
        and link_url_normalized is null
      )
      or
      (
        -- link 非草稿/已补全：原始链接和规范化链接都必须存在。
        link_url is not null
        and link_url_normalized is not null
      )
    )
  )
);
