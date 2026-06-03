"use client";

import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const optionBoxClass =
  "flex size-[1.125rem] shrink-0 items-center justify-center rounded-[6px] border shadow-sm transition-all border-[var(--border-strong)] bg-[var(--bg-elevated)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[var(--bg)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:[&_svg]:opacity-100 text-[var(--accent-fg,#0d1117)]";

type CheckboxOptionCardProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "title"
> & {
  heading: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconTone?: IconTileTone;
  className?: string;
};

/** Full-width selectable row (node / inbound / profile lists). */
export function CheckboxOptionCard({
  heading,
  description,
  icon: Icon,
  iconTone = "accent",
  className = "",
  id,
  checked,
  disabled,
  ...rest
}: CheckboxOptionCardProps) {
  const autoId = useId();
  const cid = id ?? autoId;
  const active = Boolean(checked);

  return (
    <label
      htmlFor={cid}
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        active
          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_11%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_22%,transparent)]"
          : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]",
        disabled && "cursor-not-allowed opacity-55 hover:border-[var(--border)] hover:bg-[var(--bg-elevated)]",
        className,
      )}
    >
      <input
        {...rest}
        id={cid}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className={optionBoxClass} aria-hidden>
        <Check className="size-3 opacity-0 transition-opacity" strokeWidth={2.75} />
      </span>
      {Icon ? (
        <IconTile icon={Icon} tone={active ? iconTone : "neutral"} size="sm" className="mt-0.5" />
      ) : null}
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-sm font-medium leading-snug text-[var(--fg)]">{heading}</span>
        {description != null ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

type RadioOptionCardProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "title"
> & {
  heading: ReactNode;
  description?: ReactNode;
  name: string;
  className?: string;
};

/** Single-choice row (e.g. Xray core profile on node registration). */
export function RadioOptionCard({
  heading,
  description,
  className = "",
  id,
  checked,
  disabled,
  name,
  ...rest
}: RadioOptionCardProps) {
  const autoId = useId();
  const cid = id ?? autoId;
  const active = Boolean(checked);

  return (
    <label
      htmlFor={cid}
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        active
          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_11%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_22%,transparent)]"
          : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]",
        disabled && "cursor-not-allowed opacity-55",
        className,
      )}
    >
      <input
        {...rest}
        id={cid}
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        className={cx(
          "mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border shadow-sm transition-all",
          "border-[var(--border-strong)] bg-[var(--bg-elevated)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[var(--bg)]",
          "peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)]",
        )}
        aria-hidden
      >
        <span className="size-2 rounded-full bg-[var(--accent-fg,#0d1117)] opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-[var(--fg)]">{heading}</span>
        {description != null ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

type CheckboxOptionListProps = {
  children: ReactNode;
  /** Vertical stack or responsive two-column grid */
  layout?: "stack" | "grid";
  className?: string;
  /** Toolbar above list (select all, count, …) */
  header?: ReactNode;
};

export function CheckboxOptionList({
  children,
  layout = "stack",
  className = "",
  header,
}: CheckboxOptionListProps) {
  return (
    <div className={cx("space-y-2", className)}>
      {header}
      <div
        className={
          layout === "grid"
            ? "grid max-h-[min(50vh,20rem)] gap-2 overflow-y-auto sm:grid-cols-2"
            : "flex max-h-[min(50vh,20rem)] flex-col gap-2 overflow-y-auto pr-0.5"
        }
      >
        {children}
      </div>
    </div>
  );
}

type SelectionListToolbarProps = {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  selectAllLabel: string;
  selectNoneLabel: string;
  countLabel?: string;
};

export function SelectionListToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onSelectNone,
  selectAllLabel,
  selectNoneLabel,
  countLabel,
}: SelectionListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] px-3 py-2">
      {countLabel != null ? (
        <span className="text-xs text-[var(--fg-muted)]">{countLabel}</span>
      ) : (
        <span className="text-xs tabular-nums text-[var(--fg-muted)]">
          {selectedCount} / {totalCount}
        </span>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-40"
          disabled={totalCount === 0 || selectedCount >= totalCount}
          onClick={onSelectAll}
        >
          {selectAllLabel}
        </button>
        <span className="text-[var(--border)]" aria-hidden>
          ·
        </span>
        <button
          type="button"
          className="text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline disabled:opacity-40"
          disabled={selectedCount === 0}
          onClick={onSelectNone}
        >
          {selectNoneLabel}
        </button>
      </div>
    </div>
  );
}
