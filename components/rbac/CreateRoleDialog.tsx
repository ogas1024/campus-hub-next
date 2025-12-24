"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { withDialogHref } from "@/lib/navigation/dialog";

export function CreateRoleDialog() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseHref = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  return (
    <Link className={buttonVariants()} href={withDialogHref(baseHref, { dialog: "role-create" })} scroll={false}>
      新增角色
    </Link>
  );
}
