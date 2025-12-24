import { cn } from "@/lib/utils";

type Props = {
  name: string;
  userId: string;
  avatarUrl: string | null;
  size?: number;
  className?: string;
};

function hashToHue(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

function pickInitial(name: string) {
  const v = name.trim();
  return v ? v[0]!.toUpperCase() : "?";
}

export function UserAvatar(props: Props) {
  const size = props.size ?? 28;
  const hue = hashToHue(props.userId);
  const borderColor = `hsl(${hue} 70% 50% / 0.45)`;

  if (props.avatarUrl) {
    return (
      <span
        className={cn("inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-muted", props.className)}
        style={{ width: size, height: size }}
        title={props.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.avatarUrl} alt={`${props.name} 头像`} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-foreground", props.className)}
      style={{ width: size, height: size, borderColor }}
      title={props.name}
      aria-label={`${props.name} 头像`}
    >
      {pickInitial(props.name)}
    </span>
  );
}

