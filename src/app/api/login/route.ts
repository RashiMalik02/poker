import { NextResponse } from "next/server";
import { loginOrRegister } from "@/server/db";
import { signToken } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  const { user, error } = loginOrRegister(username, password);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Login failed" }, { status: 401 });
  }
  const token = signToken(user.id);
  return NextResponse.json({ token, user });
}
