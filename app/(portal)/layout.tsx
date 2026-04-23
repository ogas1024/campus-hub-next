import { getCurrentUser } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/PortalShell";
import { portalNavItems } from "@/lib/navigation/modules";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const consoleHref = user ? "/console" : null;

  return (
    <PortalShell user={user} consoleHref={consoleHref} navItems={portalNavItems}>
      {children}
    </PortalShell>
  );
}
