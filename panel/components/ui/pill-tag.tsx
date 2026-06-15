import type { ReactNode } from "react";

type PillTone = "green" | "blue" | "neutral" | "amber" | "rose";

const tones: Record<PillTone, string> = {
  green: "status-pill status-pill--green",
  blue: "status-pill status-pill--blue",
  neutral: "status-pill status-pill--neutral",
  amber: "status-pill status-pill--amber",
  rose: "status-pill status-pill--rose",
};

export function PillTag({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
