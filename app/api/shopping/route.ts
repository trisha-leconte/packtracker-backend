import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { CreateShoppingItemSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const moveId = req.nextUrl.searchParams.get("moveId");
  if (!moveId) return NextResponse.json({ error: "moveId required" }, { status: 400 });
  if (!(await canAccessMove(userId, moveId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const items = await db.collection("shopping_items").find({ move_id: new ObjectId(moveId) }).sort({ created_at: -1 }).toArray();
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateShoppingItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { moveId, name, category } = parsed.data;
  if (!(await canAccessMove(userId, moveId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const doc = { move_id: new ObjectId(moveId), name, category: category || "", checked: false, added_by: new ObjectId(userId), created_at: new Date() };
  const result = await db.collection("shopping_items").insertOne(doc);
  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
