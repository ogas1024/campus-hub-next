import type * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  message?: React.ReactNode | null;
  className?: string;
};

export function InlineMessage(props: Props) {
  if (!props.message) return null;
  return (
    <div className={cn("ch-enter rounded-lg border border-border bg-muted p-3 text-sm", props.className)}>
      {props.message}
    </div>
  );
}

