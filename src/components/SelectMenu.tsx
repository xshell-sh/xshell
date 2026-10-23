import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string> { value: T; label: string }

// App-styled replacement for <select>. The native popup is drawn by the OS in WebView2 and
// can't be themed, so this renders its own menu in the context-menu style. Keyboard: arrows
// move, Enter/Space picks, Escape closes. Opens upward when there's no room below.
export function SelectMenu<T extends string>({ value, options, onChange, disabled }: { value: T; options: SelectOption<T>[]; onChange: (value: T) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current || !menuRef.current) return;
    const trigger = rootRef.current.getBoundingClientRect();
    setDropUp(trigger.bottom + menuRef.current.offsetHeight + 8 > window.innerHeight && trigger.top > menuRef.current.offsetHeight + 8);
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setHighlight(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  };
  const pick = (v: T) => { setOpen(false); if (v !== value) onChange(v); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => (h + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => (h - 1 + options.length) % options.length); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[highlight]) pick(options[highlight].value); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className="select-menu" ref={rootRef}>
      <button type="button" className={`select-menu-trigger${open ? " open" : ""}`} disabled={disabled} onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKeyDown} aria-haspopup="listbox" aria-expanded={open}>
        <span className="select-menu-value">{current?.label ?? ""}</span>
        <ChevronDown size={13} className="select-menu-chevron" />
      </button>
      {open && (
        <div ref={menuRef} className={`select-menu-list${dropUp ? " up" : ""}`} role="listbox">
          {options.map((o, i) => (
            <div key={o.value} role="option" aria-selected={o.value === value}
              className={`select-menu-item${o.value === value ? " selected" : ""}${i === highlight ? " highlighted" : ""}`}
              onMouseEnter={() => setHighlight(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(o.value)}>
              <span>{o.label}</span>
              {o.value === value && <Check size={12} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
