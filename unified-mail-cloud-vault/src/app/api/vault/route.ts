import { desc } from "drizzle-orm";
import { db } from "@/db";
import { vaultMessages } from "@/db/schema";
import { iso } from "@/lib/presets";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = new Set(["text", "image", "file", "code", "link"]);

export async function GET() {
  await ensureSeedData();
  const rows = await db
    .select()
    .from(vaultMessages)
    .orderBy(desc(vaultMessages.createdAt))
    .limit(400);

  return Response.json({
    messages: rows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        content: row.content,
        fileName: row.fileName,
        fileMime: row.fileMime,
        fileData: row.fileData,
        createdAt: iso(row.createdAt) || new Date().toISOString(),
      })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    kind?: string;
    content?: string;
    fileName?: string | null;
    fileMime?: string | null;
    fileData?: string | null;
  };

  const kind = KINDS.has(body.kind || "") ? (body.kind as string) : "text";
  const content = (body.content || "").trim();
  if (!content && !body.fileData) {
    return Response.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  const [created] = await db
    .insert(vaultMessages)
    .values({
      kind,
      content,
      fileName: body.fileName || null,
      fileMime: body.fileMime || null,
      fileData: body.fileData || null,
    })
    .returning();

  return Response.json({
    message: {
      id: created.id,
      kind: created.kind,
      content: created.content,
      fileName: created.fileName,
      fileMime: created.fileMime,
      fileData: created.fileData,
      createdAt: iso(created.createdAt) || new Date().toISOString(),
    },
  });
}
