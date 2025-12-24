import { redirect } from "next/navigation";

export default function NewVotePage() {
  redirect("/console/votes?dialog=vote-create");
}
