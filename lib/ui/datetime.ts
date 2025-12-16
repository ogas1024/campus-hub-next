const zhDateTime = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatZhDateTime(value: Date | null) {
  if (!value) return "—";
  return zhDateTime.format(value);
}

