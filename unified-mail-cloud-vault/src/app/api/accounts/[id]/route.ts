import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) {
    return Response.json({ error: "Invalid account." }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);

  if (!account) {
    return Response.json({ error: "Account not found." }, { status: 404 });
  }

  await db.delete(emailAccounts).where(eq(emailAccounts.id, accountId));
  return Response.json({ ok: true });
}
