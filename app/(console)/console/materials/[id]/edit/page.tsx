import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleMaterialEditPage({ params }: Params) {
  const { id } = await params;
  redirect(`/console/materials?dialog=material-edit&id=${encodeURIComponent(id)}`);
}
