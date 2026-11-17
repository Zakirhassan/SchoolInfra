export const MIN_PASSWORD_LENGTH = 12;
export const PASSWORD_MAX_AGE_DAYS = 30;

/** Returns a user-facing error message, or null if the new password is acceptable. */
export function validateNewPassword(oldPassword: string, newPassword: string): string | null {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (newPassword === oldPassword) return 'New password must be different from the old password';
  return null;
}

export function passwordStatus(changedAt: Date | string | null, now: Date = new Date()) {
  const t = changedAt ? new Date(changedAt).getTime() : NaN;
  if (Number.isNaN(t)) return { changedAt: null, daysSinceChange: null, changeRequired: true };
  const daysSinceChange = Math.max(0, Math.floor((now.getTime() - t) / 86400000));
  return { changedAt: new Date(t).toISOString(), daysSinceChange, changeRequired: daysSinceChange >= PASSWORD_MAX_AGE_DAYS };
}
