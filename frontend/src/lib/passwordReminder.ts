export const MIN_PASSWORD_LENGTH = 12;

type Status = { changeRequired?: boolean } | null | undefined;

/** Banner shows for admins whose password is due for a change, unless dismissed this session. */
export function shouldShowBanner(role: string | undefined, status: Status, dismissed: boolean, pathname = '/'): boolean {
  return role === 'ADMIN' && !!status?.changeRequired && !dismissed && pathname !== '/change-password';
}

/** Returns an error message or null. */
export function validatePasswordForm(oldPw: string, newPw: string, confirm: string): string | null {
  if (!oldPw) return 'Enter your current password';
  if (newPw.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (newPw === oldPw) return 'New password must be different from the current password';
  if (newPw !== confirm) return 'New password and confirmation do not match';
  return null;
}
