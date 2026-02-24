import { cookies } from "next/headers";
import ThemeShell from "@/components/checklists/ThemeShell";

type HeaderUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
} | null;

export default async function ThemeShellServer({
  children,
  user = null,
}: {
  children: React.ReactNode;
  user?: HeaderUser;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("checklists-theme")?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";

  return (
    <ThemeShell user={user} initialTheme={initialTheme}>
      {children}
    </ThemeShell>
  );
}
