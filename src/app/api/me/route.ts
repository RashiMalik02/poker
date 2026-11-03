import { getUser } from "@/server/db";
import { json, preflight, userFromRequest } from "@/server/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export function GET(req: Request) {
  const userId = userFromRequest(req);
  if (!userId) return json({ error: "Not signed in" }, 401);
  const user = getUser(userId);
  if (!user) return json({ error: "Unknown user" }, 401);
  return json({ user });
}
