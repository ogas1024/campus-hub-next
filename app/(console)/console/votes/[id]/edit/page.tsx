import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleVoteEditPage({ params }: Params) {
  const { id } = await params;
  redirect(`/console/votes?dialog=vote-edit&id=${encodeURIComponent(id)}`);
}
