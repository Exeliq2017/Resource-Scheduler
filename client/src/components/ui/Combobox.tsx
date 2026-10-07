import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional rich rendering for the option row (e.g. colored fragments) — falls back to `label`. */
  labelNode?: ReactNode;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className,
  allowFreeText = false,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowFreeText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (allowFreeText) onChange(query);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [query, allowFreeText, onChange]);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (allowFreeText) onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-surface-border bg-white py-1 shadow-lg">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setQuery(o.label);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted"
            >
              {o.labelNode ?? o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
