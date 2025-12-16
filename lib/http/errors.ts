export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new HttpError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "未登录") {
  return new HttpError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "无权限") {
  return new HttpError(403, "FORBIDDEN", message);
}

export function notFound(message = "资源不存在或不可见") {
  return new HttpError(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown) {
  return new HttpError(409, "CONFLICT", message, details);
}

