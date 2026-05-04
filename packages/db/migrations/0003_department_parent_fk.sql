-- 基础设施约束增强：部门 parent_id 自引用外键
-- 目的：落实“禁止删除存在子部门的部门”的硬约束，避免出现孤儿部门节点。
-- 自引用外键的意思是：departments.parent_id 仍然引用 departments.id，只是引用的是同一张表。

-- 确保 parent_id 索引存在（加速树查询/外键检查）
create index if not exists departments_parent_id_idx on public.departments(parent_id);

-- 预检：若存在 parent_id 指向不存在的记录，直接失败（要求先修复脏数据）
-- 这一步是“加约束前先查脏数据”。如果历史数据已经不合法，直接加外键会失败；
-- 主动抛出更清楚的错误，方便知道要先修哪类数据。
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
-- on delete restrict 表示：如果某部门仍被其他部门当作 parent_id，就不能删除它。
-- 答辩可说：这是参照完整性，防止产生“父部门不存在的孤儿部门”。
do $$
begin
  alter table public.departments
    add constraint departments_parent_id_fk
    foreign key (parent_id) references public.departments(id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;
