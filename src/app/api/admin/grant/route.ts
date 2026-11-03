import { grantChips, isAdmin } from "@/server/db";
import { json, preflight, userFromRequest } from "@/server/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  const userId = userFromRequest(req);
  if (!userId || !isAdmin(userId)) return json({ error: "Not authorized" }, 403);
  let body: { targetId?: number; amount?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const result = grantChips(Number(body.targetId), Number(body.amount));
  if (result.error) return json({ error: result.error }, 400);
  return json({ ok: true });
}
