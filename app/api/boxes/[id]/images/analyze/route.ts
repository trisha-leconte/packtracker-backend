import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { canAccessBox } from "@/lib/access";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

// POST /api/boxes/:id/images/analyze — analyze an image to detect items
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const boxId = params.id;

  const box = await canAccessBox(userId, boxId);
  if (!box) {
    return NextResponse.json({ error: "Box not found" }, { status: 404 });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const body = await req.json();
  const { imageUrl } = body;

  if (!imageUrl) {
    return NextResponse.json(
      { error: "imageUrl is required" },
      { status: 400 }
    );
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are helping someone inventory items for a move. Look at the image and list every distinct item you can see. Return ONLY a JSON array of strings, each string being one item name. Be specific but concise (e.g. 'French press' not 'A French press coffee maker'). If you see multiples of the same item, list it once with a count like 'Plates (6)'. Do not include any explanation, just the JSON array.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";

    // Parse the JSON array from the response
    let items: string[];
    try {
      // Handle cases where GPT wraps in markdown code blocks
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) {
        items = [];
      }
      // Ensure all items are strings
      items = items.filter((i) => typeof i === "string" && i.trim().length > 0);
    } catch {
      items = [];
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error("OpenAI Vision error:", e);
    return NextResponse.json(
      { error: "Failed to analyze image: " + (e.message || "Unknown error") },
      { status: 500 }
    );
  }
}
