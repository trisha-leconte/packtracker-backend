import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// PATCH /api/inspections/:id/media/:mediaId — update note/room
export async function PATCH(req: NextRequest, { params }: { params: { id: string; mediaId: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const inspection = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, inspection.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.note !== undefined) updates["media.$.note"] = body.note;
  if (body.room !== undefined) updates["media.$.room"] = body.room;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await db.collection("inspections").updateOne(
    { _id: new ObjectId(params.id), "media._id": new ObjectId(params.mediaId) },
    { $set: updates }
  );

  const updated = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  return NextResponse.json(updated);
}

// DELETE /api/inspections/:id/media/:mediaId
export async function DELETE(req: NextRequest, { params }: { params: { id: string; mediaId: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const inspection = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, inspection.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const media = (inspection.media || []).find((m: any) => m._id.equals(new ObjectId(params.mediaId)));
  if (media) {
    try { await deleteFromCloudinary(media.public_id); } catch {}
  }

  await db.collection("inspections").updateOne(
    { _id: new ObjectId(params.id) },
    { $pull: { media: { _id: new ObjectId(params.mediaId) } } as any }
  );

  return new NextResponse(null, { status: 204 });
}
