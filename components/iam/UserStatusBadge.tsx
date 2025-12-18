import { cn } from "@/lib/utils";

import type { UserStatus } from "@/lib/api/iam";

const meta: Record<UserStatus, { label: string; className: string }> = {
  pending_email_verification: { label: "待邮箱验证", className: "bg-muted text-muted-foreground" },
  pending_approval: { label: "待审核", className: "bg-amber-500/10 text-amber-700" },
  active: { label: "启用", className: "bg-emerald-500/10 text-emerald-700" },
  disabled: { label: "停用", className: "bg-muted text-muted-foreground" },
  banned: { label: "封禁", className: "bg-destructive/10 text-destructive" },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", meta[status].className)}>{meta[status].label}</span>;
}
