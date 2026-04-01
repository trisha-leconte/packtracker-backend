import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessMove } from "@/lib/access";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// POST /api/inspections/:id/media — upload photo or video
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  const db = await getDb();
  const inspection = await db.collection("inspections").findOne({ _id: new ObjectId(params.id) });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessMove(userId, inspection.move_id.toHexString()))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const isVideo = file.type.startsWith("video/");
  const buffer = Buffer.from(await file.arrayBuffer());

  const { publicId, url } = await uploadToCloudinary(
    buffer,
    `inspections/${params.id}`,
    isVideo ? "video" : "image"
  );

  const mediaEntry = {
    _id: new ObjectId(),
    url,
    type: isVideo ? "video" : "photo",
    public_id: publicId,
    note: "",
    room: "",
    created_at: new Date(),
  };

  await db.collection("inspections").updateOne(
    { _id: new ObjectId(params.id) },
    { $push: { media: mediaEntry } as any }
  );

  return NextResponse.json(mediaEntry, { status: 201 });
}
