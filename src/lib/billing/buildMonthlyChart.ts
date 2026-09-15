interface InvoiceLike {
  issueMonth: string;
  total: number;
}

export function buildMonthlyChart<T extends InvoiceLike>(invoices: T[]) {
  const buckets: Record<string, number> = {};
  for (const inv of invoices) {
    buckets[inv.issueMonth] = (buckets[inv.issueMonth] ?? 0) + inv.total;
  }
  return Object.entries(buckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount: Math.round(amount / 1_000_000) }));
}
