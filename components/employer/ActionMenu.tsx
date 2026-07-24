"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export type ActionMenuItem =
  | { type: "link"; href: string; label: string }
  | { type: "button"; label: string; onClick: () => void; danger?: boolean; disabled?: boolean };

/** Overflow "⋯" menu for secondary page-header actions — keeps the primary
 * action visible and stops a header's button row from wrapping to multiple
 * lines as more actions get added. Closes on outside click or Escape. */
export default function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="action-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost action-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="action-menu-list" role="menu">
          {items.map((item, i) =>
            item.type === "link" ? (
              <Link
                key={i}
                href={item.href}
                className="action-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                className={`action-menu-item${item.danger ? " is-danger" : ""}`}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
