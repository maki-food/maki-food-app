export function getPeriodRange(period) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (!period || period === 'all') return { start: null, end: null };
  if (period === 'today') return { start: startOfDay, end: endOfDay };

  if (period === 'week') {
    // Last 7 days including today
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { start, end: endOfDay };
  }

  if (period === 'month') {
    // Start of current calendar month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: endOfDay };
  }

  return { start: null, end: null };
}

export default getPeriodRange;
