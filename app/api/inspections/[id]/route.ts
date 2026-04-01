import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { UpdateInspectionSchema } from "@/lib/validate";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// PATCH /api/inspections/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const inspection = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, inspection.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateInspectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.date !== undefined) updates.date = new Date(parsed.data.date);

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await db.collection("inspections").updateOne({ _id: new ObjectId(params.id) }, { $set: updates });
  const updated = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  return NextResponse.json(updated);
}

// DELETE /api/inspections/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const inspection = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, inspection.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all media from Cloudinary
  for (const m of inspection.media || []) {
    try { await deleteFromCloudinary(m.public_id); } catch {}
  }

  await db.collection("inspections").deleteOne({ _id: new ObjectId(params.id) });
  return new NextResponse(null, { status: 204 });
}
