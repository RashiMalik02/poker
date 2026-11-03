import { isAdmin, listUsers } from "@/server/db";
import { json, preflight, userFromRequest } from "@/server/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export function GET(req: Request) {
  const userId = userFromRequest(req);
  if (!userId || !isAdmin(userId)) return json({ error: "Not authorized" }, 403);
  return json({ users: listUsers() });
}
