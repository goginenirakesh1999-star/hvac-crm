// Sign-in is by username + password. Supabase Auth is email-based, so each
// username maps to a synthetic email on this fixed domain (nothing is ever
// sent to it — accounts are created pre-confirmed). Account creation uses the
// exact same mapping so the derived email matches.
export const LOGIN_DOMAIN = "getrockysolutions.com";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;
}
