import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { startOfWeek, differenceInCalendarWeeks, getYear, isBefore } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFinancialWeek(date: Date): { week: number, year: number } {
  // Week starts on Sunday (0)
  // Week 1 is the week that contains April 5th
  const year = getYear(date);
  
  const getWeek1Start = (y: number) => {
    const april5 = new Date(y, 3, 5); // Month is 0-indexed, so 3 is April
    return startOfWeek(april5, { weekStartsOn: 0 });
  };

  let startOfFinancialYear = getWeek1Start(year);
  let financialYear = year;

  // If the date is before Week 1 of the current year, it belongs to the previous financial year
  if (isBefore(date, startOfFinancialYear)) {
    financialYear = year - 1;
    startOfFinancialYear = getWeek1Start(financialYear);
  }

  const weekNumber = differenceInCalendarWeeks(date, startOfFinancialYear, { weekStartsOn: 0 }) + 1;

  return { week: weekNumber, year: financialYear };
}

export function getLondonDate(): Date {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(new Date());
  const dateParts: Record<string, string> = {};
  for (const part of parts) {
    dateParts[part.type] = part.value;
  }
  
  return new Date(
    parseInt(dateParts.year),
    parseInt(dateParts.month) - 1,
    parseInt(dateParts.day),
    parseInt(dateParts.hour),
    parseInt(dateParts.minute),
    parseInt(dateParts.second)
  );
}
