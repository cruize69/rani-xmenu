// Client-side only. What's stored in sessionStorage is a signed, 12h-
// expiring session token minted by /api/manager-login — never the raw
// manager password itself. Losing this value (XSS, a stray log, shoulder-
// surfing devtools) doesn't hand over the master credential the way storing
// the password directly used to; it just grants a time-boxed session that
// self-expires and can't be replayed indefinitely.
const STORAGE_KEY = "rm_manager_secret";

export const getManagerSecret = () => sessionStorage.getItem(STORAGE_KEY) ?? "";
export const clearManagerSecret = () => sessionStorage.removeItem(STORAGE_KEY);

// Exchanges the typed password for a session token via /api/manager-login
// and stores the token (not the password). Returns true on success.
export async function loginManager(password) {
  const res = await fetch("/api/manager-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || (res.status === 429 ? "Too many attempts — try again later." : "Incorrect password.") };
  }
  const { token } = await res.json();
  sessionStorage.setItem(STORAGE_KEY, token);
  return { ok: true };
}
