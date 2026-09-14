/** Milliseconds for sorting. Missing or junk dates go last. */
export function dateValue(value: Date | number | string | null | undefined): number {
  if (value instanceof Date) {
    const ms = value.valueOf();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/** Newest first. Optional extra compare breaks ties (same day). */
export function newestFirst<T>(
  items: readonly T[],
  dateOf: (item: T) => Date | number | string | null | undefined,
  extra?: (a: T, b: T) => number,
): T[] {
  return [...items].sort((a, b) => {
    const byDate = dateValue(dateOf(b)) - dateValue(dateOf(a));
    if (byDate !== 0) return byDate;
    return extra ? extra(a, b) : 0;
  });
}
