"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { withDialogHref } from "@/lib/navigation/dialog";

type Props = {
  canCreate: boolean;
  canInvite: boolean;
};

export function CreateUserDialog(props: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!props.canCreate && !props.canInvite) return null;
  const baseHref = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  return (
    <Link className={buttonVariants()} href={withDialogHref(baseHref, { dialog: "user-create" })} scroll={false}>
      新增用户
    </Link>
  );
}
