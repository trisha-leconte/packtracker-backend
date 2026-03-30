import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";

export const dynamic = "force-dynamic";

// GET /api/images?moveId=xxx — list all images in a move
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const moveId = req.nextUrl.searchParams.get("moveId");

  if (!moveId) {
    return NextResponse.json({ error: "moveId required" }, { status: 400 });
  }

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const db = await getDb();
  const images = await db
    .collection("images")
    .find({ move_id: new ObjectId(moveId) })
    .sort({ created_at: -1 })
    .toArray();

  return NextResponse.json(images);
}
