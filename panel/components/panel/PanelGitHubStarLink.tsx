"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const SHARX_GITHUB_REPO_URL = "https://github.com/konstpic/SharX";
const SHARX_GITHUB_API_URL = "https://api.github.com/repos/konstpic/SharX";
/** Persist stargazer count in localStorage to avoid GitHub anonymous rate limits (60/h/IP). */
const CACHE_KEY = "sharx:github-stars";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type Cached = { count: number; fetchedAt: number };

function readCached(): Cached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Cached>;
    if (typeof parsed.count === "number" && typeof parsed.fetchedAt === "number") {
      return { count: parsed.count, fetchedAt: parsed.fetchedAt };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCached(count: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ count, fetchedAt: Date.now() } satisfies Cached),
    );
  } catch {
    /* ignore */
  }
}

function formatStarCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(n / 1000)}k`;
}

export function PanelGitHubStarLink() {
  const { t } = useTranslation();
  const [stars, setStars] = useState<number | null>(() => {
    const cached = readCached();
    return cached ? cached.count : null;
  });

  useEffect(() => {
    const cached = readCached();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;

    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(SHARX_GITHUB_API_URL, {
          headers: { Accept: "application/vnd.github+json" },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { stargazers_count?: number };
        if (cancelled) return;
        if (typeof json.stargazers_count === "number") {
          setStars(json.stargazers_count);
          writeCached(json.stargazers_count);
        }
      } catch {
        /* ignore network errors; we keep cached value if any */
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const label = t("menu.starOnGithub", {
    defaultValue: "Star SharX on GitHub",
  });

  return (
    <a
      href={SHARX_GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-amber-200/80 transition-colors hover:bg-[rgba(250,204,21,0.10)] hover:text-amber-200"
      aria-label={label}
      title={label}
    >
      <Star className="size-[18px] shrink-0" aria-hidden />
      {stars != null ? (
        <span className="hidden text-xs font-semibold tabular-nums sm:inline">
          {formatStarCount(stars)}
        </span>
      ) : null}
    </a>
  );
}
