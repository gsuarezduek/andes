import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { getOnlineUsers } from "@/lib/presence";

export const runtime = "nodejs";

/** Otros usuarios conectados ahora — pollea el widget del header, no un heartbeat. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const users = await getOnlineUsers(user.id);
  return NextResponse.json(users);
}
