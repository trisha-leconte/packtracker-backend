import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { CreateInspectionSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/inspections?moveId=xxx
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const moveId = req.nextUrl.searchParams.get("moveId");
  if (!moveId) return NextResponse.json({ error: "moveId required" }, { status: 400 });
  if (!(await canAccessMove(userId, moveId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const inspections = await db
    .collection("inspections")
    .find({ move_id: new ObjectId(moveId) })
    .sort({ type: 1 })
    .toArray();

  return NextResponse.json(inspections);
}

// POST /api/inspections
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateInspectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { moveId, type, date, notes } = parsed.data;
  if (!(await canAccessMove(userId, moveId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const moveOid = new ObjectId(moveId);

  // Check if inspection of this type already exists
  const existing = await db.collection("inspections").findOne({ move_id: moveOid, type });
  if (existing) return NextResponse.json({ error: "Inspection already exists" }, { status: 409 });

  const doc = {
    move_id: moveOid,
    type,
    date: date ? new Date(date) : new Date(),
    notes: notes || "",
    media: [],
    created_by: new ObjectId(userId),
    created_at: new Date(),
  };

  const result = await db.collection("inspections").insertOne(doc);
  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
