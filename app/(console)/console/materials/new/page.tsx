import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewMaterialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const noticeId = (pickString(sp.noticeId) ?? "").trim();

  const qs = new URLSearchParams();
  qs.set("dialog", "material-create");
  if (noticeId) qs.set("noticeId", noticeId);

  redirect(`/console/materials?${qs.toString()}`);
}
