import { badRequest } from "@/lib/http/errors";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidRegex.test(value);
}

export function requireUuid(value: string, name: string) {
  if (!value || !isUuid(value)) throw badRequest(`${name} 必须为 UUID`);
  return value;
}

export function parseIsoDateTime(value: string, name: string) {
  const v = value?.trim();
  if (!v) throw badRequest(`${name} 必填`);
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw badRequest(`${name} 必须为 ISO 时间字符串`);
  return d;
}

const durationTokenRegex = /(\d+)(ms|s|m|h|d|w)/g;

export function parseDurationMs(value: string) {
  const v = value.trim();
  if (!v) throw badRequest("duration 必填");
  if (!/^(?:\d+(?:ms|s|m|h|d|w))+$/.test(v)) {
    throw badRequest("duration 格式无效（示例：10m/2h/1h30m/7d/4w）");
  }

  let total = 0;
  for (const match of v.matchAll(durationTokenRegex)) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest("duration 格式无效");
    const factor =
      unit === "ms"
        ? 1
        : unit === "s"
          ? 1000
          : unit === "m"
            ? 60 * 1000
            : unit === "h"
              ? 60 * 60 * 1000
              : unit === "d"
                ? 24 * 60 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000;
    total += amount * factor;
  }

  if (!Number.isFinite(total) || total <= 0) throw badRequest("duration 格式无效");
  return total;
}

export function overlapSeconds(params: { startA: Date; endA: Date; startB: Date; endB: Date }) {
  const start = Math.max(params.startA.getTime(), params.startB.getTime());
  const end = Math.min(params.endA.getTime(), params.endB.getTime());
  const ms = Math.max(0, end - start);
  return Math.floor(ms / 1000);
}
