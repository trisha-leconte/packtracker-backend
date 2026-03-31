import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";

export const dynamic = "force-dynamic";

// GET /api/items?moveId=xxx — list all items in a move with box info
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
  const items = await db
    .collection("items")
    .aggregate([
      {
        $lookup: {
          from: "boxes",
          localField: "box_id",
          foreignField: "_id",
          as: "box",
        },
      },
      { $unwind: { path: "$box", preserveNullAndEmptyArrays: true } },
      { $match: { "box.move_id": new ObjectId(moveId) } },
      {
        $lookup: {
          from: "users",
          localField: "added_by",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          box_id: 1,
          image_id: 1,
          added_by: 1,
          added_by_name: { $ifNull: ["$user.name", null] },
          created_at: 1,
          box_label: "$box.label",
          room: "$box.room",
          box_status: "$box.status",
          condition_before: 1,
          condition_after: 1,
          photos_before: 1,
          photos_after: 1,
        },
      },
      { $sort: { name: 1 } },
    ])
    .toArray();

  return NextResponse.json(items);
}
