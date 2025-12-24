import { redirect } from "next/navigation";

export default function NewMyResourcePage() {
  redirect("/resources/me?dialog=resource-create");
}
