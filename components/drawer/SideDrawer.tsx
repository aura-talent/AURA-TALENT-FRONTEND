"use client";

import type { ReactNode } from "react";
import styles from "./SideDrawer.module.css";

export default function SideDrawer({
  open,
  onClose,
  width = "480px",
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayActive : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  );
}
