"use client";

import { useEffect, useMemo, useState } from "react";
import { getBasePath } from "@/lib/paths";

/** Star Wars panel decor — fan artwork on the cinema backdrop (panel shell only). */

function useStarWarsThemeActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const read = () => {
      setActive(document.documentElement.getAttribute("data-panel-theme") === "starWars");
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-panel-theme"],
    });
    window.addEventListener("sharx-panel-theme", read);
    return () => {
      obs.disconnect();
      window.removeEventListener("sharx-panel-theme", read);
    };
  }, []);

  return active;
}

function ThemedDecorImage({
  asset,
  className,
}: {
  asset: string;
  className?: string;
}) {
  const src = useMemo(() => `${getBasePath()}/themes/${asset}`, [asset]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static decor assets on cinema backdrop
    <img src={src} alt="" className={className} decoding="async" draggable={false} />
  );
}

function AstromechDroid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="sw-r2-body" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#e8ecf4" />
          <stop offset="100%" stopColor="#9aa8be" />
        </linearGradient>
      </defs>
      <g opacity="0.9">
        <rect x="10" y="28" width="28" height="28" rx="4" fill="url(#sw-r2-body)" />
        <rect x="12" y="32" width="8" height="6" rx="1" fill="#4bd5ee" opacity="0.8" />
        <rect x="22" y="34" width="12" height="4" rx="1" fill="#2d3748" opacity="0.5" />
        <ellipse cx="24" cy="18" rx="14" ry="12" fill="url(#sw-r2-body)" />
        <circle cx="24" cy="16" r="5" fill="#1a2233" opacity="0.35" />
        <circle cx="20" cy="14" r="2" fill="#4bd5ee" />
        <circle cx="28" cy="14" r="2" fill="#4bd5ee" />
        <rect x="8" y="54" width="6" height="8" rx="1" fill="#7a8799" />
        <rect x="34" y="54" width="6" height="8" rx="1" fill="#7a8799" />
        <rect x="18" y="8" width="12" height="6" rx="2" fill="#c5d0e0" />
      </g>
    </svg>
  );
}

function ProtocolDroid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="sw-c3-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5e6a8" />
          <stop offset="45%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#a67c00" />
        </linearGradient>
      </defs>
      <g opacity="0.88">
        <ellipse cx="20" cy="10" rx="9" ry="8" fill="url(#sw-c3-gold)" />
        <rect x="14" y="16" width="12" height="4" rx="1" fill="#c9a227" />
        <path
          d="M12 20 L28 20 L26 52 L14 52 Z"
          fill="url(#sw-c3-gold)"
        />
        <rect x="16" y="24" width="8" height="14" rx="1" fill="#8b6914" opacity="0.35" />
        <path d="M8 52 L14 52 L12 78 L6 78 Z" fill="#c9a227" />
        <path d="M26 52 L32 52 L34 78 L28 78 Z" fill="#c9a227" />
        <path d="M14 52 L26 52 L24 82 L16 82 Z" fill="#d4af37" />
        <circle cx="17" cy="8" r="1.5" fill="#2d1f00" />
        <circle cx="23" cy="8" r="1.5" fill="#2d1f00" />
        <path
          d="M16 12 Q20 14 24 12"
          stroke="#8b6914"
          strokeWidth="1"
          fill="none"
        />
      </g>
    </svg>
  );
}

export function StarWarsCinemaDecor() {
  const active = useStarWarsThemeActive();
  if (!active) return null;

  return (
    <span className="panel-cinema-bg__ships" aria-hidden>
      <ThemedDecorImage
        asset="death-star.png"
        className="panel-cinema-ship panel-cinema-ship--deathstar"
      />
      <ThemedDecorImage
        asset="millennium-falcon.png"
        className="panel-cinema-ship panel-cinema-ship--falcon"
      />
      <AstromechDroid className="panel-cinema-ship panel-cinema-ship--r2" />
      <ProtocolDroid className="panel-cinema-ship panel-cinema-ship--c3" />
    </span>
  );
}
