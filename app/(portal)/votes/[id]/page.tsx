import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function VoteDetailPage({ params }: Params) {
  const { id } = await params;
  redirect(`/votes?dialog=vote-fill&id=${encodeURIComponent(id)}`);
}
