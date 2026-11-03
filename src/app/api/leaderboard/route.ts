import { leaderboard } from "@/server/db";
import { CORS, json, preflight } from "@/server/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export function GET() {
  void CORS;
  return json({ leaders: leaderboard(20) });
}
