import { redirect } from "next/navigation";

export default function TemplatesEditionVisualPage() {
  redirect("/templates/editor?mode=visual");
}
