import { redirect } from "next/navigation";

export default function TemplatesEditionFilePage() {
  redirect("/templates/editor?mode=file");
}
