/** Formats a date as DD/MM/YYYY using local time. */
export function toDisplayDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${day}/${month}/${date.getFullYear()}`;
}

/** Formats a date as YYYY-MM-DD using local time. */
export function toIsoDate(date: Date): string {
    const [day, month, year] = toDisplayDate(date).split('/');
    return `${year}-${month}-${day}`;
}

export function dateInDays(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}
