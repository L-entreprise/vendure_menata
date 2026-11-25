/**
 * Calendar dates as `YYYY-MM-DD` in the server's time zone (set TZ=Europe/Paris in
 * production). Follow-ups are due on a day, not at an instant, so plain strings compare
 * and bucket correctly without time zone arithmetic.
 */
export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function localDate(offsetDays = 0, from: Date = new Date()): string {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function isLocalDate(value: string): boolean {
    if (!LOCAL_DATE_PATTERN.test(value)) {
        return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
