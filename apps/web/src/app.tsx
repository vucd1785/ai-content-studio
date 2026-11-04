import { LoginPage } from "@/features/session/login-page";
import { useSession } from "@/features/session/use-session";
import { AppShell } from "@/features/shell/app-shell";
import { vi } from "@/i18n/vi";

export function App() {
  const session = useSession();

  if (session.isPending) {
    return <p className="p-4 text-sm">{vi.app.loading}</p>;
  }
  if (session.data?.authenticated === true) {
    return <AppShell />;
  }
  return <LoginPage />;
}
