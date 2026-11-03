import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Minimal signed token: base64(userId.expiry).hmac — no external JWT dep.
export function signToken(userId: number): string {
  const payload = `${userId}.${Date.now() + TOKEN_TTL_MS}`;
  const body = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string | undefined): number | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  const payload = Buffer.from(body, "base64url").toString();
  const [userIdStr, expiryStr] = payload.split(".");
  const userId = Number(userIdStr);
  const expiry = Number(expiryStr);
  if (!userId || !expiry || Date.now() > expiry) return null;
  return userId;
}
