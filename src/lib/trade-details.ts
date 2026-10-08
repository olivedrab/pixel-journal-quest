/** Preserve exchange-local timestamps without inventing a timezone. */
export function normalizeTradeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().replaceAll("/", "-").replace(" ", "T");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(normalized)
    ? normalized.length === 16 ? `${normalized}:00` : normalized
    : null;
}

export function detailsFromNotes(notes: string | null | undefined) {
  const text = notes ?? "";
  function amount(label: string) {
    const value = text.match(new RegExp(`${label}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i"))?.[1];
    return value === undefined ? null : Number(value);
  }
  const margin = text.match(/margin\s*:\s*-?\d+(?:\.\d+)?\s*([A-Za-z]{2,12})/i);
  return {
    margin: amount("margin"),
    margin_currency: margin?.[1]?.toUpperCase() ?? null,
    leverage: amount("leverage"),
    opened_at: normalizeTradeTimestamp(text.match(/opened\s*:?\s*(\d{4}[/-]\d{2}[/-]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)/i)?.[1]),
    closed_at: normalizeTradeTimestamp(text.match(/closed\s*:?\s*(\d{4}[/-]\d{2}[/-]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)/i)?.[1]),
    close_type: text.match(/close type\s*:\s*([^;.\n]+)/i)?.[1]?.trim() ?? null,
    trading_fee: amount("trading fee"),
    funding_fee: amount("funding fee"),
  };
}