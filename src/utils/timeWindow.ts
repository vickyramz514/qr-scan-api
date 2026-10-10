const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPlausibleEventTime(value: string, now = Date.now()): boolean {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }

  return time <= now + MAX_FUTURE_SKEW_MS && now - time <= MAX_AGE_MS;
}
