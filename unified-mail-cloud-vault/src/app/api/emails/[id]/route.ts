import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, emails } from "@/db/schema";
import { iso } from "@/lib/presets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const emailId = Number(id);
  if (!Number.isFinite(emailId)) {
    return Response.json({ error: "Invalid email." }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: emails.id,
      accountId: emails.accountId,
      accountLabel: emailAccounts.label,
      accountColor: emailAccounts.color,
      accountEmail: emailAccounts.email,
      messageId: emails.messageId,
      fromName: emails.fromName,
      fromEmail: emails.fromEmail,
      toEmail: emails.toEmail,
      cc: emails.cc,
      subject: emails.subject,
      snippet: emails.snippet,
      bodyText: emails.bodyText,
      bodyHtml: emails.bodyHtml,
      isStarred: emails.isStarred,
      isRead: emails.isRead,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .innerJoin(emailAccounts, eq(emails.accountId, emailAccounts.id))
    .where(and(eq(emails.id, emailId), eq(emails.isDeleted, false)))
    .limit(1);

  if (!row) {
    return Response.json({ error: "Email not found." }, { status: 404 });
  }

  if (!row.isRead) {
    await db.update(emails).set({ isRead: true }).where(eq(emails.id, emailId));
  }

  return Response.json({
    email: {
      ...row,
      isRead: true,
      receivedAt: iso(row.receivedAt) || new Date().toISOString(),
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const emailId = Number(id);
  if (!Number.isFinite(emailId)) {
    return Response.json({ error: "Invalid email." }, { status: 400 });
  }

  const body = (await request.json()) as {
    isStarred?: boolean;
    isRead?: boolean;
    isDeleted?: boolean;
  };

  const patch: {
    isStarred?: boolean;
    isRead?: boolean;
    isDeleted?: boolean;
  } = {};
  if (typeof body.isStarred === "boolean") patch.isStarred = body.isStarred;
  if (typeof body.isRead === "boolean") patch.isRead = body.isRead;
  if (typeof body.isDeleted === "boolean") patch.isDeleted = body.isDeleted;

  if (!Object.keys(patch).length) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(emails)
    .set(patch)
    .where(eq(emails.id, emailId))
    .returning({
      id: emails.id,
      isStarred: emails.isStarred,
      isRead: emails.isRead,
      isDeleted: emails.isDeleted,
    });

  if (!updated) {
    return Response.json({ error: "Email not found." }, { status: 404 });
  }

  return Response.json({ email: updated });
}
