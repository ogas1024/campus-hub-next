# API 文档（契约）

本目录用于存放“可直接驱动实现”的 API 契约文档，作为前后端协作的单一事实来源。

## 约定

- 基础路径：所有接口以 `/api` 开头。
- 鉴权：默认使用 Supabase Auth，会话来自 Cookie；除非接口特别声明允许匿名。
- 错误结构（统一）：

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "人类可读信息",
    "details": {}
  }
}
```

- 分页：采用 `page` / `pageSize`，响应包含 `total`。

