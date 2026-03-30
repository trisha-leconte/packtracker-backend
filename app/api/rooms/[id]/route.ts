import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// PATCH /api/rooms/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const db = await getDb();

  const room = await db
    .collection("rooms")
    .findOne({ _id: new ObjectId(params.id) });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!(await canAccessMove(userId, room.move_id.toHexString()))) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpdateRoomSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // If renaming, also update all boxes in this room
  if (updates.name && updates.name !== room.name) {
    await db.collection("boxes").updateMany(
      { move_id: room.move_id, room: room.name },
      { $set: { room: updates.name } }
    );
  }

  await db
    .collection("rooms")
    .updateOne({ _id: new ObjectId(params.id) }, { $set: updates });

  const updated = await db
    .collection("rooms")
    .findOne({ _id: new ObjectId(params.id) });

  return NextResponse.json(updated);
}

// DELETE /api/rooms/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const db = await getDb();

  const room = await db
    .collection("rooms")
    .findOne({ _id: new ObjectId(params.id) });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!(await canAccessMove(userId, room.move_id.toHexString()))) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  await db.collection("rooms").deleteOne({ _id: new ObjectId(params.id) });

  return new NextResponse(null, { status: 204 });
}
