"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  HelpCircle,
  WifiOff,
  Zap,
  ZapOff,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TFunction } from "i18next";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";

type TileWithTooltipProps = {
  icon: LucideIcon;
  tone: IconTileTone;
  label: string;
};

function TileWithTooltip({ icon, tone, label }: TileWithTooltipProps) {
  const tipId = useId();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [xy, setXy] = useState({ x: 0, y: 0 });

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setXy({ x: r.left + r.width / 2, y: r.bottom + 6 });
  }, []);

  const show = useCallback(() => {
    updatePos();
    setOpen(true);
  }, [updatePos]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const close = () => hide();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, hide]);

  return (
    <>
      <span
        ref={ref}
        aria-describedby={open ? tipId : undefined}
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        className="cursor-default rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <IconTile icon={icon} tone={tone} size="sm" />
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[10000] w-max max-w-[min(16rem,calc(100vw-1rem))] rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-[var(--fg)] shadow-lg"
              style={{ left: xy.x, top: xy.y, transform: "translateX(-50%)" }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function NodeStatusBadge({ status, t }: { status: string; t: TFunction }) {
  const s = (status || "unknown").toLowerCase();
  const configs = {
    online: { icon: CheckCircle2, tone: "success" as const, label: t("pages.nodes.online") },
    offline: { icon: WifiOff, tone: "danger" as const, label: t("pages.nodes.offline") },
    error: { icon: AlertCircle, tone: "danger" as const, label: t("pages.nodes.error") },
    unknown: { icon: HelpCircle, tone: "neutral" as const, label: t("pages.nodes.unknown") },
  } as const;
  const cfg = configs[s as keyof typeof configs] ?? configs.unknown;
  return <TileWithTooltip icon={cfg.icon} tone={cfg.tone} label={cfg.label} />;
}

export function XrayStateBadge({ state, t }: { state: string | undefined; t: TFunction }) {
  const s = (state || "unknown").toLowerCase();
  const configs = {
    running: { icon: Zap, tone: "success" as const, label: t("pages.nodes.xrayStateRunning") },
    stopped: { icon: ZapOff, tone: "warning" as const, label: t("pages.nodes.xrayStateStopped") },
    error: { icon: AlertTriangle, tone: "danger" as const, label: t("pages.nodes.xrayStateError") },
    unknown: { icon: Activity, tone: "neutral" as const, label: t("pages.nodes.xrayStateUnknown") },
  } as const;
  const cfg = configs[s as keyof typeof configs] ?? configs.unknown;
  return <TileWithTooltip icon={cfg.icon} tone={cfg.tone} label={cfg.label} />;
}

export function TelemtStateBadge({ state, t }: { state: string | undefined; t: TFunction }) {
  const s = (state || "unknown").toLowerCase();
  const configs = {
    running: { icon: CircleDot, tone: "success" as const, label: t("pages.nodes.telemtStateRunning") },
    stopped: { icon: Circle, tone: "warning" as const, label: t("pages.nodes.telemtStateStopped") },
    unknown: { icon: HelpCircle, tone: "neutral" as const, label: t("pages.nodes.telemtStateUnknown") },
  } as const;
  const cfg = configs[s as keyof typeof configs] ?? configs.unknown;
  return <TileWithTooltip icon={cfg.icon} tone={cfg.tone} label={cfg.label} />;
}

export function AmneziaWgStateBadge({ state, t }: { state: string | undefined; t: TFunction }) {
  const s = (state || "unknown").toLowerCase();
  const configs = {
    running: { icon: CircleDot, tone: "success" as const, label: t("pages.nodes.amneziawgStateRunning") },
    stopped: { icon: Circle, tone: "warning" as const, label: t("pages.nodes.amneziawgStateStopped") },
    unknown: { icon: HelpCircle, tone: "neutral" as const, label: t("pages.nodes.amneziawgStateUnknown") },
  } as const;
  const cfg = configs[s as keyof typeof configs] ?? configs.unknown;
  return <TileWithTooltip icon={cfg.icon} tone={cfg.tone} label={cfg.label} />;
}
