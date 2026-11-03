import { claimAdmin, getUser } from "@/server/db";
import { json, preflight, userFromRequest } from "@/server/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  const userId = userFromRequest(req);
  if (!userId) return json({ error: "Not signed in" }, 401);
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const result = claimAdmin(userId, String(body.code ?? ""));
  if (result.error) return json({ error: result.error }, 400);
  return json({ ok: true, user: getUser(userId) });
}
