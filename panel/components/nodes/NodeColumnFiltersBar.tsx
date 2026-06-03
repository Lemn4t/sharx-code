"use client";

import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { Input, SelectNative } from "@/components/ui";

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
        {label}
      </label>
      {children}
    </div>
  );
}

type NodeColumnFiltersBarProps = {
  t: TFunction;
  nameFilter: string;
  onNameFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  xrayStateFilter: string;
  onXrayStateFilterChange: (value: string) => void;
};

export function NodeColumnFiltersBar({
  t,
  nameFilter,
  onNameFilterChange,
  statusFilter,
  onStatusFilterChange,
  xrayStateFilter,
  onXrayStateFilterChange,
}: NodeColumnFiltersBarProps) {
  return (
    <div className="grid gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-3 py-2 sm:grid-cols-2 lg:grid-cols-3">
      <FilterField label={t("pages.nodes.search")}>
        <Input
          value={nameFilter}
          onChange={(e) => onNameFilterChange(e.target.value)}
          placeholder={t("pages.nodes.search")}
          className="!h-8 w-full min-w-0 !px-2 !py-1 !text-xs"
        />
      </FilterField>
      <FilterField label={t("pages.nodes.status")}>
        <SelectNative
          inputSize="sm"
          className="w-full min-w-0 shadow-none"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label={t("pages.nodes.status")}
        >
          <option value="all">{t("pages.nodes.filterAllStatuses")}</option>
          <option value="online">{t("pages.nodes.online")}</option>
          <option value="offline">{t("pages.nodes.offline")}</option>
          <option value="unknown">{t("pages.nodes.unknown")}</option>
          <option value="error">{t("pages.nodes.error")}</option>
        </SelectNative>
      </FilterField>
      <FilterField label={t("pages.nodes.xrayState")}>
        <SelectNative
          inputSize="sm"
          className="w-full min-w-0 shadow-none"
          value={xrayStateFilter}
          onChange={(e) => onXrayStateFilterChange(e.target.value)}
          aria-label={t("pages.nodes.xrayState")}
        >
          <option value="all">{t("pages.nodes.filterAllXrayStates")}</option>
          <option value="running">{t("pages.nodes.xrayStateRunning")}</option>
          <option value="stopped">{t("pages.nodes.xrayStateStopped")}</option>
          <option value="error">{t("pages.nodes.xrayStateError")}</option>
          <option value="unknown">{t("pages.nodes.xrayStateUnknown")}</option>
        </SelectNative>
      </FilterField>
    </div>
  );
}
