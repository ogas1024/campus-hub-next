export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiResponseError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildErrorFromJson(status: number, json: unknown) {
  const payload = (json as { error?: ApiErrorPayload } | null)?.error;
  if (payload?.message && payload?.code) return new ApiResponseError(status, payload);
  return new ApiResponseError(status, { code: "INTERNAL_ERROR", message: "请求失败" });
}

export async function apiFetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: "same-origin", ...init });
  const json = await readJsonSafe(response);

  if (!response.ok) {
    throw buildErrorFromJson(response.status, json);
  }

  if (json == null) {
    throw new ApiResponseError(502, { code: "INTERNAL_ERROR", message: "服务端响应不是 JSON" });
  }

  return json as T;
}

export function apiGetJson<T>(input: string) {
  return apiFetchJson<T>(input, { method: "GET" });
}

export function apiPostJson<T>(input: string, body?: unknown) {
  return apiFetchJson<T>(input, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPutJson<T>(input: string, body: unknown) {
  return apiFetchJson<T>(input, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function apiDeleteJson<T>(input: string) {
  return apiFetchJson<T>(input, { method: "DELETE" });
}

export function apiPostForm<T>(input: string, formData: FormData) {
  return apiFetchJson<T>(input, { method: "POST", body: formData });
}

