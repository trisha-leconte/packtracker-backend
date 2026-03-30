import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessBox } from "@/lib/access";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// DELETE /api/boxes/:id/images/:imageId
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  const userId = await getUserId(req);
  const { id: boxId, imageId } = params;

  const box = await canAccessBox(userId, boxId);
  if (!box) {
    return NextResponse.json({ error: "Box not found" }, { status: 404 });
  }

  const db = await getDb();
  const image = await db
    .collection("images")
    .findOne({ _id: new ObjectId(imageId), box_id: new ObjectId(boxId) });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    await deleteFromCloudinary(image.public_id);
  } catch (e) {
    console.error("Cloudinary delete error:", e);
  }

  await db.collection("images").deleteOne({ _id: new ObjectId(imageId) });

  return new NextResponse(null, { status: 204 });
}
