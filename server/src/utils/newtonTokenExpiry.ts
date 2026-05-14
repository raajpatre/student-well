const THIRTY_DAYS_SECS = 30 * 24 * 60 * 60;

export function isTokenExpired(expiresAt: number): boolean {
  return Math.floor(Date.now() / 1000) >= expiresAt;
}

export function isTokenExpiringSoon(expiresAt: number): boolean {
  return expiresAt - Math.floor(Date.now() / 1000) <= THIRTY_DAYS_SECS;
}

export function daysUntilExpiry(expiresAt: number): number {
  const secs = expiresAt - Math.floor(Date.now() / 1000);
  return Math.floor(secs / 86400);
}
