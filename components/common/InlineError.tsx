import { cn } from "@/lib/utils";

type Props = {
  message?: string | null;
  className?: string;
};

export function InlineError(props: Props) {
  if (!props.message) return null;
  return (
    <div className={cn("rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive", props.className)}>
      {props.message}
    </div>
  );
}

