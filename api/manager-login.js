// POST /api/manager-login  { password }  ->  { token }
// Replaces the old pattern of stashing MANAGER_SECRET itself in
// sessionStorage and replaying it on every staff-tool request. Staff now
// exchange the password once for a signed, 12h-expiring token (see
// mintManagerToken/checkManagerAuth in lib/auth.js) and that token is what
// gets stored/replayed instead — losing it doesn't leak the master password.
import { isManagerSecretValid, mintManagerToken } from "../lib/auth.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};
  if (isManagerSecretValid(password)) {
    return res.status(200).json({ token: mintManagerToken() });
  }

  const locked = await overLimit(`mgr-auth-fail:${clientIp(req)}`, 10, 3600);
  return res.status(locked ? 429 : 401).json({ error: locked ? "Too many attempts — try again later." : "Incorrect password." });
}
