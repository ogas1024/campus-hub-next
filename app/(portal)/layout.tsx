import { getCurrentUser } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/PortalShell";
import { hasAnyPerm } from "@/lib/auth/permissions";
import { consoleEntryPermCodes, portalNavItems } from "@/lib/navigation/modules";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const canEnterConsole = user ? await hasAnyPerm(user.id, [...consoleEntryPermCodes]) : false;

  return (
    <PortalShell user={user} canEnterConsole={canEnterConsole} navItems={portalNavItems}>
      {children}
    </PortalShell>
  );
}
