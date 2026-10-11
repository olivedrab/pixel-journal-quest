import type { Trade } from "./trades.functions";

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthRange(year: number, month: number) {
  return {
    from: toISODate(new Date(year, month, 1)),
    to: toISODate(new Date(year, month + 1, 0)),
  };
}

/** Days rendered in a Monday-first month grid, including padding days. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, iso: toISODate(date), inMonth: date.getMonth() === month };
  });
}

export function groupByDay(trades: Trade[]) {
  const map = new Map<string, Trade[]>();
  for (const trade of trades) {
    const list = map.get(trade.trade_date) ?? [];
    list.push(trade);
    map.set(trade.trade_date, list);
  }
  return map;
}

export function sumPnl(trades: { pnl: number | null }[]) {
  return trades.reduce((total, t) => total + Number(t.pnl ?? 0), 0);
}

export function formatMoney(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
