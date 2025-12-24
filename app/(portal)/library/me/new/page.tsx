import { redirect } from "next/navigation";

export default function NewMyLibraryBookPage() {
  redirect("/library/me?dialog=library-create");
}
