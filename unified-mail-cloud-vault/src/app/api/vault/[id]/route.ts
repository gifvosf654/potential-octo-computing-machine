import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vaultMessages } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const messageId = Number(id);
  if (!Number.isFinite(messageId)) {
    return Response.json({ error: "Invalid message." }, { status: 400 });
  }

  await db.delete(vaultMessages).where(eq(vaultMessages.id, messageId));
  return Response.json({ ok: true });
}
