import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Width style passthrough, e.g. '100%' or 220. */
  width?: number | string;
}

/**
 * Reusable div-based dropdown (no native `<select>`).
 * The option list renders in a portal so it never gets clipped inside
 * tables or modals. Keyboard: Enter/Space/ArrowDown opens, arrows move,
 * Enter picks, Escape closes.
 */
export function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  label,
  disabled = false,
  ariaLabel,
  width,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, above: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const listHeight = Math.min(260, 48 + options.length * 44);
    const above = window.innerHeight - r.bottom < listHeight + 12 && r.top > listHeight + 12;
    setPos({
      top: above ? r.top - listHeight - 6 : r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8),
      width: Math.max(r.width, 180),
      above,
    });
  };

  useLayoutEffect(() => {
    if (open) measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        // Portal list clicks carry a marker so they don't close prematurely.
        if (!(e.target as HTMLElement).closest?.('[data-dropdown-list]')) setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open ]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const toggle = () => {
    if (disabled) return;
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen((o) => !o);
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
      setOpen(true);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (options.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[highlight] ?? options.find((o) => o.value === value);
      if (opt) pick(opt.value);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`dropdown${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
      style={width !== undefined ? { width } : undefined}
    >
      {label && <span className="dropdown-label">{label}</span>}
      <div
        ref={triggerRef}
        className="dropdown-trigger"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={onTriggerKey}
      >
        <span className={selected ? 'dropdown-value' : 'dropdown-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="dropdown-caret" aria-hidden>
          ▾
        </span>
      </div>
      {open &&
        createPortal(
          <div
            id={listId}
            data-dropdown-list
            className="dropdown-list dropdown-portal"
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKey}
            style={{ top: pos.top, left: Math.max(8, pos.left), width: pos.width }}
          >
            {options.length === 0 && <div className="dropdown-empty">No options</div>}
            {options.map((o, i) => (
              <div
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={
                  `dropdown-item${o.value === value ? ' selected' : ''}` +
                  (i === highlight ? ' highlighted' : '')
                }
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(o.value)}
              >
                <span>{o.label}</span>
                {o.value === value && (
                  <span className="dropdown-check" aria-hidden>
                    ✓
                  </span>
                )}
                {o.hint && <span className="dropdown-hint">{o.hint}</span>}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
