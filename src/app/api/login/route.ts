import { NextResponse } from "next/server";
import { loginOrRegister } from "@/server/db";
import { signToken } from "@/server/auth";

export const dynamic = "force-dynamic";

// Allow the (separately deployed) frontend origin to call this endpoint.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: CORS });
  }
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400, headers: CORS }
    );
  }
  const { user, error } = loginOrRegister(username, password);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Login failed" }, { status: 401, headers: CORS });
  }
  const token = signToken(user.id);
  return NextResponse.json({ token, user }, { headers: CORS });
}
