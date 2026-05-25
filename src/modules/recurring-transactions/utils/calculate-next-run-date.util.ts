import { RecurringFrequency } from '../enums/frequency.enum';

export function calculateNextRunDate(
  date: Date,
  frequency: RecurringFrequency,
): Date {
  const next = new Date(date);

  switch (frequency) {
    case RecurringFrequency.DAILY: {
      next.setDate(next.getDate() + 1);
      return next;
    }
    case RecurringFrequency.WEEKLY: {
      next.setDate(next.getDate() + 7);
      return next;
    }
    case RecurringFrequency.MONTHLY: {
      const originalDay = next.getDate();
      next.setMonth(next.getMonth() + 1);

      // Handle month-end edge cases (e.g. Jan 31 → Feb 28/29).
      if (next.getDate() < originalDay) {
        next.setDate(0);
      }
      return next;
    }
    case RecurringFrequency.YEARLY: {
      next.setFullYear(next.getFullYear() + 1);
      return next;
    }
    default: {
      throw new Error(`Unsupported recurring frequency: ${String(frequency)}`);
    }
  }
}
