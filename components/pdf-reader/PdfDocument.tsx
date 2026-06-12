"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import styles from "./PdfReader.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_SCALE = 0.65;
const MAX_SCALE = 1.6;
const SCALE_STEP = 0.15;

export default function PdfDocument({
  file,
  title,
}: {
  file: string;
  title: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [availableWidth, setAvailableWidth] = useState(760);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () =>
      setAvailableWidth(Math.max(Math.min(viewport.clientWidth - 48, 860), 280));
    const observer = new ResizeObserver(updateWidth);

    updateWidth();
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.round(availableWidth * scale);

  return (
    <section className={styles.reader} aria-label={title}>
      <div className={styles.readerToolbar}>
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            aria-label="Previous page"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page <b>{pageNumber}</b> of <b>{numPages || "–"}</b>
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((current) => current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={scale <= MIN_SCALE}
            onClick={() =>
              setScale((current) =>
                Math.max(MIN_SCALE, current - SCALE_STEP),
              )
            }
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={scale >= MAX_SCALE}
            onClick={() =>
              setScale((current) =>
                Math.min(MAX_SCALE, current + SCALE_STEP),
              )
            }
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className={styles.readerViewport} ref={viewportRef}>
        <Document
          file={file}
          loading={
            <div className={styles.readerState}>
              <span className={styles.loadingSpinner} />
              <p>Rendering document…</p>
            </div>
          }
          error={
            <div className={styles.readerState}>
              <strong>Document preview unavailable</strong>
              <p>Download the PDF to review it.</p>
              <a className="btn btn-primary" href={file} download>
                Download PDF
              </a>
            </div>
          }
          onLoadSuccess={({ numPages: loadedPages }) => {
            setNumPages(loadedPages);
            setPageNumber(1);
          }}
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={null}
          />
        </Document>
      </div>
    </section>
  );
}
