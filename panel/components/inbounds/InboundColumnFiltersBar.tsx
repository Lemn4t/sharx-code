"use client";

import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { CompareModeFilterField, type CompareOp } from "@/components/CompareModeFilterField";
import { Input, SelectNative } from "@/components/ui";

type InboundColumnFilterId = "remark" | "tag" | "protocol" | "port" | "traffic";
type InboundFilterStatus = "" | "enabled" | "disabled";

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

function InboundColumnFilterInput({
  value,
  onChange,
  placeholder,
  className = "",
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  prefix?: string;
}) {
  const input = (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={
        prefix
          ? `!h-8 min-w-0 flex-1 !border-0 !bg-transparent !px-2 !py-1 !text-xs ${className}`
          : `!h-8 w-full min-w-0 !px-2 !py-1 !text-xs ${className}`
      }
    />
  );
  if (!prefix) return input;
  return (
    <div
      className={`flex min-w-0 items-stretch overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] ${className}`}
    >
      <span
        className="flex shrink-0 items-center border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--border)_35%,transparent)] px-1.5 font-mono text-xs font-semibold text-[var(--fg-muted)]"
        aria-hidden
      >
        {prefix}
      </span>
      {input}
    </div>
  );
}

type InboundColumnFiltersBarProps = {
  t: TFunction;
  columnFilters: Record<InboundColumnFilterId, string>;
  onColumnFiltersChange: (
    updater: (prev: Record<InboundColumnFilterId, string>) => Record<InboundColumnFilterId, string>,
  ) => void;
  trafficCompareOp: CompareOp;
  onTrafficCompareOpChange: (op: CompareOp) => void;
  filterStatus: InboundFilterStatus;
  onFilterStatusChange: (status: InboundFilterStatus) => void;
};

export function InboundColumnFiltersBar({
  t,
  columnFilters,
  onColumnFiltersChange,
  trafficCompareOp,
  onTrafficCompareOpChange,
  filterStatus,
  onFilterStatusChange,
}: InboundColumnFiltersBarProps) {
  const setFilter = (key: InboundColumnFilterId, value: string) => {
    onColumnFiltersChange((f) => ({ ...f, [key]: value }));
  };

  return (
    <div className="grid gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-3 py-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
      <FilterField label={t("remark")}>
        <InboundColumnFilterInput
          value={columnFilters.remark}
          onChange={(v) => setFilter("remark", v)}
          placeholder={t("pages.clients.filterColEmail", { defaultValue: "Contains…" })}
        />
      </FilterField>
      <FilterField label={t("pages.inbounds.tagColumn", { defaultValue: "Tag" })}>
        <InboundColumnFilterInput
          value={columnFilters.tag}
          onChange={(v) => setFilter("tag", v)}
          placeholder={t("pages.inbounds.filterTag", { defaultValue: "Tag contains…" })}
        />
      </FilterField>
      <FilterField label={t("protocol")}>
        <InboundColumnFilterInput
          value={columnFilters.protocol}
          onChange={(v) => setFilter("protocol", v)}
          placeholder={t("pages.clients.filterColComment", { defaultValue: "Contains…" })}
        />
      </FilterField>
      <FilterField label={t("pages.inbounds.port")}>
        <InboundColumnFilterInput
          value={columnFilters.port}
          onChange={(v) => setFilter("port", v)}
          placeholder={t("pages.inbounds.filterPort", { defaultValue: "Contains…" })}
        />
      </FilterField>
      <FilterField label={t("pages.inbounds.totalDownUp", { defaultValue: "Up / down" })}>
        <CompareModeFilterField
          mode="traffic"
          compareOp={trafficCompareOp}
          onCompareOpChange={onTrafficCompareOpChange}
          value={columnFilters.traffic}
          onValueChange={(v) => setFilter("traffic", v)}
          placeholder={
            trafficCompareOp === ""
              ? t("pages.clients.filterColTraffic", { defaultValue: "Contains…" })
              : t("pages.clients.filterTrafficAmount", { defaultValue: "e.g. 10 gb" })
          }
          className="w-full"
        />
      </FilterField>
      <FilterField label={t("status")}>
        <SelectNative
          inputSize="sm"
          className="w-full min-w-0 shadow-none"
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value as InboundFilterStatus)}
          aria-label={t("status")}
        >
          <option value="">
            {t("pages.clients.filterConnAll", { defaultValue: "All" })}
          </option>
          <option value="enabled">{t("enabled")}</option>
          <option value="disabled">{t("disabled")}</option>
        </SelectNative>
      </FilterField>
    </div>
  );
}
