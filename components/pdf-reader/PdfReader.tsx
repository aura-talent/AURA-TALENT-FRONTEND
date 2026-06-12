"use client";

import dynamic from "next/dynamic";
import styles from "./PdfReader.module.css";

const PdfDocument = dynamic(() => import("./PdfDocument"), {
  ssr: false,
  loading: () => (
    <div className={styles.readerState}>
      <span className={styles.loadingSpinner} />
      <p>Loading document…</p>
    </div>
  ),
});

export default function PdfReader({
  file,
  title,
}: {
  file: string;
  title: string;
}) {
  return <PdfDocument file={file} title={title} />;
}
