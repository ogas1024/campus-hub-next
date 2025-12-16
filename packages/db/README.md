# 数据库（packages/db）

本目录用于维护 Drizzle schema 与迁移脚本（以 Supabase Postgres 为目标数据库）。

## 目录说明

- `src/schema/**`：Drizzle schema（类型与迁移源）
- `migrations/**`：手工 SQL 迁移（用于包含触发器 / RLS 策略等 Drizzle kit 不擅长表达的部分）

## 本地/远端初始化（推荐流程）

1. 在 Supabase Dashboard 打开 **SQL Editor**
2. 依次执行 `migrations/` 下的 SQL（从小到大）

> 后续接入 drizzle-kit 后，会在本目录增加自动生成的迁移目录（如 `drizzle/`），届时再统一收敛执行顺序。

