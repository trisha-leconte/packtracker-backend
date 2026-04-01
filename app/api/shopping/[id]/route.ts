import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { UpdateShoppingItemSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const item = await db.collection("shopping_items").findOne({ _id: new ObjectId(params.id) });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, item.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateShoppingItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  await db.collection("shopping_items").updateOne({ _id: new ObjectId(params.id) }, { $set: { ...parsed.data } });
  const updated = await db.collection("shopping_items").findOne({ _id: new ObjectId(params.id) });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const item = await db.collection("shopping_items").findOne({ _id: new ObjectId(params.id) });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, item.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.collection("shopping_items").deleteOne({ _id: new ObjectId(params.id) });
  return new NextResponse(null, { status: 204 });
}
