import type { PortalModuleId } from "@/lib/navigation/modules";
import { cn } from "@/lib/utils";

type Props = {
  moduleId: PortalModuleId;
  className?: string;
};

export function ModuleIcon({ moduleId, className }: Props) {
  const common = {
    className: cn("h-5 w-5", className),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (moduleId) {
    case "notices":
      return (
        <svg {...common} aria-hidden>
          <path d="M8 3h8l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M16 3v5h5" />
          <path d="M9 12h6" />
          <path d="M9 16h8" />
        </svg>
      );
    case "resources":
      return (
        <svg {...common} aria-hidden>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          <path d="M8 13h8" />
        </svg>
      );
    case "facilities":
      return (
        <svg {...common} aria-hidden>
          <path d="M7 4v3" />
          <path d="M17 4v3" />
          <path d="M4 8h16" />
          <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
          <path d="M8 12h4" />
          <path d="M8 16h6" />
        </svg>
      );
    case "surveys":
      return (
        <svg {...common} aria-hidden>
          <path d="M9 3h6l2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2l2-2z" />
          <path d="M9 3v4h6V3" />
          <path d="M8 12h8" />
          <path d="M8 16h6" />
        </svg>
      );
    case "votes":
      return (
        <svg {...common} aria-hidden>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "library":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 19a2 2 0 0 0 2 2h14" />
          <path d="M6 2h12a2 2 0 0 1 2 2v17H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
          <path d="M8 6h8" />
          <path d="M8 10h8" />
        </svg>
      );
    case "lost-found":
      return (
        <svg {...common} aria-hidden>
          <path d="M11 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
          <path d="M21 21l-4.3-4.3" />
          <path d="M11 9v4" />
          <path d="M11 7h.01" />
        </svg>
      );
  }
}
