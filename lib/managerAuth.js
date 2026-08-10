// Client-side only. The manager password lives in sessionStorage, typed in
// per browser session — never baked into the build, so it can't be read out
// of the public JS bundle the way a VITE_-prefixed env var would be.
const STORAGE_KEY = "rm_manager_secret";

export const getManagerSecret = () => sessionStorage.getItem(STORAGE_KEY) ?? "";
export const setManagerSecret = (value) => sessionStorage.setItem(STORAGE_KEY, value);
export const clearManagerSecret = () => sessionStorage.removeItem(STORAGE_KEY);

// EventSource can't send custom headers, so the SSE stream can't be
// authenticated with the raw x-manager-secret header the way normal fetch
// calls are — that would put the long-lived manager password directly in a
// URL (and therefore in server/proxy access logs). Instead, exchange the
// secret for a short-lived, single-purpose token via an authenticated POST,
// and put that in the stream URL instead.
export async function getStreamToken() {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-manager-secret": getManagerSecret(),
    },
    body: JSON.stringify({ action: "stream_token" }),
  });
  if (!res.ok) throw new Error("Failed to get stream token");
  const { token } = await res.json();
  return token;
}
