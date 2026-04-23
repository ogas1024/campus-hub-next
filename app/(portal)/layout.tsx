import { getCurrentUser } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/PortalShell";
import { resolveConsoleLandingHref } from "@/lib/navigation/consoleLanding";
import { portalNavItems } from "@/lib/navigation/modules";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const consoleHref = user ? await resolveConsoleLandingHref(user.id) : null;

  return (
    <PortalShell user={user} consoleHref={consoleHref} navItems={portalNavItems}>
      {children}
    </PortalShell>
  );
}
