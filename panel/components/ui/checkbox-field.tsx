import { Check } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Mouse click on a label focuses the sr-only input and the browser scrolls
 * overflow parents to bring it into view. We:
 *   1. preventDefault on left mousedown (suppresses focus-on-click in most browsers), and
 *   2. anchor the sr-only input to the label via `position: relative` on the label
 *      (so even if focus still moves, scrollIntoView is a no-op — the input is
 *      already inside the label, which is by definition visible).
 */
function preventLabelFocusScroll(e: MouseEvent<HTMLLabelElement>) {
  if (e.button === 0) e.preventDefault();
}

/** Visual box (must follow a `peer` checkbox input in the same label). */
export const checkboxControlClass =
  "flex size-[1.125rem] shrink-0 items-center justify-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-sm transition-all peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] text-[var(--accent-fg,#0d1117)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[var(--bg)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

const CheckboxInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function CheckboxInput(props, ref) {
    return (
      <>
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <span className={checkboxControlClass} aria-hidden>
          <Check
            className="size-3 opacity-0 transition-opacity peer-checked:opacity-100"
            strokeWidth={2.75}
          />
        </span>
      </>
    );
  },
);

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  className?: string;
};

/** Standalone checkbox (wraps control in a clickable label). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className = "", ...rest },
  ref,
) {
  return (
    <label
      onMouseDown={preventLabelFocusScroll}
      className={cx(
        "relative inline-flex shrink-0 cursor-pointer items-center",
        rest.disabled && "cursor-not-allowed",
        className,
      )}
    >
      <CheckboxInput ref={ref} {...rest} />
    </label>
  );
});

type CheckboxFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  label: ReactNode;
  className?: string;
  align?: "center" | "start";
};

export function CheckboxField({
  label,
  className = "",
  id,
  align = "center",
  ...rest
}: CheckboxFieldProps) {
  const autoId = useId();
  const cid = id ?? autoId;
  return (
    <label
      htmlFor={cid}
      onMouseDown={preventLabelFocusScroll}
      className={cx(
        "relative flex cursor-pointer gap-2.5 text-sm text-[var(--fg-muted)]",
        align === "start" ? "items-start" : "items-center",
        rest.disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <CheckboxInput id={cid} {...rest} />
      <span className={cx("min-w-0 flex-1 leading-snug", align === "start" && "pt-0.5")}>
        {label}
      </span>
    </label>
  );
}
