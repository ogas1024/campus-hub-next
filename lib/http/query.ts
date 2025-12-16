export function parseIntParam(
  value: string | null,
  options: { defaultValue: number; min?: number; max?: number },
) {
  if (value == null) return options.defaultValue;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return options.defaultValue;

  const intValue = Math.trunc(parsed);
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, intValue));
}

export function parseBooleanParam(value: string | null, options: { defaultValue: boolean }) {
  if (value == null) return options.defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  return options.defaultValue;
}

export function parseTriStateBooleanParam(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

