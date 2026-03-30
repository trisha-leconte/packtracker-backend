import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateRoomSchema = z.object({
  moveId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// GET /api/rooms?moveId=xxx
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
  const rooms = await db
    .collection("rooms")
    .find({ move_id: new ObjectId(moveId) })
    .sort({ name: 1 })
    .toArray();

  return NextResponse.json(rooms);
}

// POST /api/rooms
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateRoomSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { moveId, name, color } = parsed.data;

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const db = await getDb();

  // Check for duplicate name
  const existing = await db.collection("rooms").findOne({
    move_id: new ObjectId(moveId),
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existing) {
    return NextResponse.json({ error: "Room already exists" }, { status: 409 });
  }

  const doc = {
    move_id: new ObjectId(moveId),
    name,
    color,
    created_by: new ObjectId(userId),
    created_at: new Date(),
  };

  const result = await db.collection("rooms").insertOne(doc);

  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
