import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function MyResourceRedirectPage({ params }: Params) {
  const { id } = await params;
  redirect(`/resources/me?dialog=resource-edit&id=${encodeURIComponent(id)}`);
}
