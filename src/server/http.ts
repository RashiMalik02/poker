import { NextResponse } from "next/server";
import { verifyToken } from "./auth";

// The frontend is deployed on a different origin (Vercel), so every API
// response the browser reads cross-origin needs these headers.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// Pull the bearer token from the Authorization header and return the user id.
export function userFromRequest(req: Request): number | null {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : auth;
  return verifyToken(token.trim());
}
