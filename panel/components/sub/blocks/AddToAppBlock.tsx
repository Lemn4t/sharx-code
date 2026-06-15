"use client";

import { Smartphone } from "lucide-react";
import {
  APP_CATALOG,
  filterAppsForSubscriptionProtocol,
  normalizeAddToAppBlock,
  type AppButton,
  type BlockAddToApp,
} from "@/lib/sharxSubpageConfig";
import { isWireGuardOnlySubscription } from "@/lib/wireguardConf";
import { resolveMtProtoLinks, tgProxyDisplayLabel } from "../types";
import shell from "../subscription-shell.module.css";
import type { BlockRenderContext } from "./index";

type RenderedButton = {
  id: string;
  label: string;
  href: string;
  iconUrl?: string;
  platforms?: string[];
  badge?: string;
};

function base64Url(input: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(input)));
  }
  return Buffer.from(input, "utf-8").toString("base64");
}

type SubstitutionVars = {
  url: string;
  urlEncoded: string;
  b64Url: string;
  urlJson: string;
  urlJsonEncoded: string;
  happEncrypted: string;
  v2raytunEncrypted: string;
};

function substitute(template: string, vars: SubstitutionVars): string {
  return template
    .replace(/\{url\}/g, vars.url)
    .replace(/\{urlEncoded\}/g, vars.urlEncoded)
    .replace(/\{b64Url\}/g, vars.b64Url)
    .replace(/\{urlJson\}/g, vars.urlJson)
    .replace(/\{urlJsonEncoded\}/g, vars.urlJsonEncoded)
    .replace(/\{happEncrypted\}/g, vars.happEncrypted)
    .replace(/\{v2raytunEncrypted\}/g, vars.v2raytunEncrypted);
}

/** Build substitution context for a given block from the public sub payload. */
function makeSubstitutionVars(opts: {
  subscriptionUrl: string;
  subscriptionJsonUrl?: string;
  happEncryptedUrl?: string;
  v2raytunEncryptedUrl?: string;
  preferJsonUrl?: boolean;
  app?: AppButton["app"];
}): SubstitutionVars {
  const catalog = opts.app ? APP_CATALOG[opts.app] : undefined;
  const preferJson =
    (opts.preferJsonUrl || catalog?.preferJsonUrl) && opts.subscriptionJsonUrl;
  const base = preferJson ? opts.subscriptionJsonUrl! : opts.subscriptionUrl;
  return {
    url: base,
    urlEncoded: encodeURIComponent(base),
    b64Url: base ? base64Url(base) : "",
    urlJson: opts.subscriptionJsonUrl ?? "",
    urlJsonEncoded: opts.subscriptionJsonUrl
      ? encodeURIComponent(opts.subscriptionJsonUrl)
      : "",
    happEncrypted: opts.happEncryptedUrl ?? "",
    v2raytunEncrypted: opts.v2raytunEncryptedUrl ?? "",
  };
}

/** Resolve one {@link AppButton} into rendered button(s) (label + final href). */
function renderButtons(
  button: AppButton,
  vars: SubstitutionVars,
  tgProxyLinks: string[],
  subscriptionJsonUrl?: string,
): RenderedButton[] {
  if (button.enabled === false) return [];
  const catalog = APP_CATALOG[button.app];
  const label = button.label?.trim() || catalog?.label || button.app;
  const iconUrl = button.iconUrl?.trim() || catalog?.iconUrl || "";

  if (button.app === "amneziawg") {
    return [];
  }

  if (button.app === "telegram") {
    if (tgProxyLinks.length === 0) return [];
    return tgProxyLinks.map((href, i) => ({
      id: tgProxyLinks.length > 1 ? `${button.id}-${i}` : button.id,
      label: tgProxyLinks.length > 1 ? `${label} · ${tgProxyDisplayLabel(href, i)}` : label,
      href,
      iconUrl,
      platforms: button.platforms,
    }));
  }

  // Prefer encrypted-specific shortcuts when admin opted in and server gave us one.
  if (button.useEncrypted && catalog?.supportsEncrypted) {
    if (button.app === "happ" && vars.happEncrypted) {
      return [
        {
          id: button.id,
          label,
          href: vars.happEncrypted,
          iconUrl,
          platforms: button.platforms,
          badge: "E2E",
        },
      ];
    }
    if (button.app === "v2raytun" && vars.v2raytunEncrypted) {
      return [
        {
          id: button.id,
          label,
          href: vars.v2raytunEncrypted,
          iconUrl,
          platforms: button.platforms,
          badge: "E2E",
        },
      ];
    }
  }

  const template =
    (button.deepLinkTemplate && button.deepLinkTemplate.trim()) ||
    catalog?.deepLinkTemplate ||
    "{url}";
  if (button.app === "sing-box" && !subscriptionJsonUrl) {
    return [];
  }
  const href = substitute(template, vars);
  if (!href) return [];
  return [
    {
      id: button.id,
      label,
      href,
      iconUrl,
      platforms: button.platforms,
    },
  ];
}

export function AddToAppBlock({
  block,
  ctx,
}: {
  block: BlockAddToApp;
  ctx: BlockRenderContext;
}) {
  const { data, interactive, t } = ctx;
  if (!data.subscriptionUrl) return null;

  const normalized = normalizeAddToAppBlock(block);
  const wgOnly = isWireGuardOnlySubscription(data.links ?? []);
  const buttons = filterAppsForSubscriptionProtocol(normalized.buttons ?? [], wgOnly);
  if (buttons.length === 0) return null;

  const preferJsonUrl = normalized.preferJsonUrl;
  const subscriptionJsonUrl = data.subscriptionJsonUrl;

  const tgProxyLinks = resolveMtProtoLinks(data);

  const rendered = buttons
    .flatMap((b) =>
      renderButtons(
        b,
        makeSubstitutionVars({
          subscriptionUrl: data.subscriptionUrl,
          subscriptionJsonUrl,
          happEncryptedUrl: data.happEncryptedUrl,
          v2raytunEncryptedUrl: data.v2raytunEncryptedUrl,
          preferJsonUrl,
          app: b.app,
        }),
        tgProxyLinks,
        subscriptionJsonUrl,
      ),
    )
    .filter((r): r is RenderedButton => r !== null);
  if (rendered.length === 0) return null;

  const title =
    normalized.title?.trim() ||
    t("pages.publicSub.addToApp", { defaultValue: "Add to app" });

  return (
    <div>
      <h2 className={shell.sectionTitle}>{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rendered.map((link) => (
          <a
            key={link.id}
            href={link.href}
            className="group flex items-center gap-3 rounded-xl border border-[var(--sub-border)] bg-[var(--sub-surface)] p-3 text-sm font-medium text-[var(--sub-fg)] transition hover:border-[color-mix(in_oklab,var(--sub-accent)_50%,transparent)] hover:bg-[var(--sub-accent-soft)]"
            onClick={(e) => {
              if (!interactive) e.preventDefault();
            }}
          >
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--sub-border)] bg-[var(--sub-surface)] text-[var(--sub-accent)]">
              {link.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.iconUrl}
                  alt=""
                  className="size-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Smartphone className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{link.label}</span>
              {link.platforms && link.platforms.length > 0 ? (
                <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider text-[var(--sub-fg-muted,rgba(201,209,217,0.6))]">
                  {link.platforms.join(" · ")}
                </span>
              ) : null}
            </span>
            {link.badge ? (
              <span className="shrink-0 rounded-full border border-[color-mix(in_oklab,var(--sub-accent)_35%,transparent)] bg-[var(--sub-accent-soft)] px-2 py-[1px] text-[10px] font-semibold tracking-wider text-[var(--sub-accent)]">
                {link.badge}
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  );
}
