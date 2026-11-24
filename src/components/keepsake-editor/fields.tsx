"use client";

// Keepsake editor: small labelled inputs shared by the panels. Every input has a visible label.
import { useId, useState } from "react";
import { ADMIN_FIELD, ADMIN_LABEL } from "@/components/admin/AdminNotice";

export const PANEL =
  "bg-surface-container-lowest border border-surface-variant rounded-lg p-4 space-y-4";
export const PANEL_TITLE = "font-headline-sm text-headline-sm text-on-background";
export const HELP = "font-body-md text-sm text-on-surface-variant";
export const SMALL_BUTTON =
  "inline-flex items-center justify-center min-h-11 px-3 rounded border border-outline-variant font-label-caps text-label-caps uppercase text-on-surface hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";

/**
 * A number input that keeps what the admin is typing, and reports a value only when it is a
 * number inside the range. Outside the range the box shows a message and nothing changes.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    // The value changed from outside (a drag, undo, a loaded project): show it, unless the box
    // already holds the same number written another way ("12." while typing "12.5").
    setSeen(value);
    if (Number(draft) !== value) setDraft(String(value));
  }
  const parsed = draft.trim() === "" ? Number.NaN : Number(draft);
  const invalid = !Number.isFinite(parsed) || parsed < min || parsed > max;

  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>
        {label}
        {suffix ? ` (${suffix})` : ""}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const next = raw.trim() === "" ? Number.NaN : Number(raw);
          if (Number.isFinite(next) && next >= min && next <= max && next !== value) onCommit(next);
        }}
        onBlur={() => {
          if (invalid) setDraft(String(value));
        }}
        className={ADMIN_FIELD}
      />
      {invalid && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-error">
          Enter a number from {min} to {max}.
        </p>
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={ADMIN_FIELD}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={help ? `${id}-help` : undefined}
        className="mt-1 h-5 w-5 shrink-0 accent-secondary"
      />
      <div>
        <label htmlFor={id} className="font-body-md text-body-md text-on-surface">
          {label}
        </label>
        {help && (
          <p id={`${id}-help`} className={HELP}>
            {help}
          </p>
        )}
      </div>
    </div>
  );
}
