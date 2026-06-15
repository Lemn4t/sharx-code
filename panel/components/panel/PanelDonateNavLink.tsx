"use client";

import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

const SHARX_DONATE_URL = "https://donate.konstpic.ru/";

export function PanelDonateNavLink() {
  const { t } = useTranslation();
  const label = t("menu.donate", { defaultValue: "Support the project" });
  return (
    <a
      href={SHARX_DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-[var(--panel-chrome-donate)] transition-colors hover:bg-[rgba(244,114,182,0.12)] hover:text-[var(--panel-chrome-donate-hover)]"
      aria-label={label}
      title={label}
    >
      <Heart className="size-[18px] shrink-0" aria-hidden />
    </a>
  );
}
