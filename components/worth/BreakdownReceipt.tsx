"use client";

import type { FairPayBand, FairPayReceiptRow } from "@/lib/api";

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, notation: "compact", maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

/** The "why this number" receipt: one row per pricing factor, then the
 * computed total. All strings/numbers arrive from the server. */
export default function BreakdownReceipt({
  receipt,
  band,
  point,
  currency,
}: {
  receipt: FairPayReceiptRow[];
  band: FairPayBand;
  point: number;
  currency: string;
}) {
  return (
    <div className="worth-receipt">
      {receipt.map((row) => (
        <div className="worth-receipt-row" key={row.id}>
          <span className="worth-receipt-label">{row.label}</span>
          <span className="worth-receipt-effect">{row.effect}</span>
          <span className="worth-receipt-why">
            {row.reasoning}
            {row.source ? <em> — {row.source}</em> : null}
          </span>
        </div>
      ))}
      <div className="worth-receipt-row worth-receipt-total">
        <span className="worth-receipt-label">YOUR_BAND</span>
        <span className="worth-receipt-effect">
          {fmt(band.p25, currency)}–{fmt(band.p75, currency)} · point {fmt(point, currency)}
        </span>
        <span className="worth-receipt-why" />
      </div>
    </div>
  );
}
