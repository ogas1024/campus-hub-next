-- 兼容性收敛：
-- 若某环境先执行了 0015（模块字典）再补跑 0008（collect engine），
-- 则 collect_tasks.module -> app_modules.code 不会自动补上。
-- 本迁移用于把“主线路径升级为全量路径”的数据库状态收敛到一致。

do $$
declare
  v_invalid_modules text;
begin
  if to_regclass('public.collect_tasks') is null then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'collect_tasks'
      and c.conname = 'collect_tasks_module_fk'
  ) then
    return;
  end if;

  select string_agg(distinct c.module, ', ' order by c.module)
    into v_invalid_modules
  from public.collect_tasks c
  left join public.app_modules m
    on m.code = c.module
  where m.code is null;

  if v_invalid_modules is not null then
    raise exception using
      errcode = '23503',
      message = 'collect_tasks contains modules not registered in app_modules: ' || v_invalid_modules,
      constraint = 'collect_tasks_module_fk';
  end if;

  alter table public.collect_tasks
    add constraint collect_tasks_module_fk
    foreign key (module)
    references public.app_modules(code)
    on delete restrict;
end $$;
