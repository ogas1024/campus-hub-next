import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function MyLibraryBookRedirectPage({ params }: Params) {
  const { id } = await params;
  redirect(`/library/me?dialog=library-edit&id=${encodeURIComponent(id)}`);
}
