-- 基础设施约束增强：部门 parent_id 自引用外键
-- 目的：落实“禁止删除存在子部门的部门”的硬约束，避免出现孤儿部门节点。

-- 确保 parent_id 索引存在（加速树查询/外键检查）
create index if not exists departments_parent_id_idx on public.departments(parent_id);

-- 预检：若存在 parent_id 指向不存在的记录，直接失败（要求先修复脏数据）
do $$
begin
  if exists (
    select 1
    from public.departments d
    where d.parent_id is not null
      and not exists (select 1 from public.departments p where p.id = d.parent_id)
  ) then
    raise exception 'departments.parent_id 存在无效引用，请先修复数据后再添加外键约束';
  end if;
end $$;

-- 添加自引用外键（存在子部门时禁止删除）
do $$
begin
  alter table public.departments
    add constraint departments_parent_id_fk
    foreign key (parent_id) references public.departments(id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;
