import { redirect } from "next/navigation";

export default function TemplatesEditionJsonPage() {
  redirect("/templates/editor?mode=json");
}
