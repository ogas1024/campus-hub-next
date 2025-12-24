export function withDialogHref(href: string, params: { dialog: string; id?: string | null }) {
  const [path, query = ""] = href.split("?");
  const sp = new URLSearchParams(query);
  sp.set("dialog", params.dialog);

  const id = params.id?.trim() ?? "";
  if (id) sp.set("id", id);
  else sp.delete("id");

  const next = sp.toString();
  return next ? `${path}?${next}` : path;
}

