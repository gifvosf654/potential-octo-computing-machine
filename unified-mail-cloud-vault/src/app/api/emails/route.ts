import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, emails } from "@/db/schema";
import { iso } from "@/lib/presets";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await ensureSeedData();

  const rows = await db
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
      subject: emails.subject,
      snippet: emails.snippet,
      isStarred: emails.isStarred,
      isRead: emails.isRead,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .innerJoin(emailAccounts, eq(emails.accountId, emailAccounts.id))
    .where(eq(emails.isDeleted, false))
    .orderBy(desc(emails.receivedAt))
    .limit(250);

  return Response.json({
    emails: rows.map((row) => ({
      ...row,
      receivedAt: iso(row.receivedAt) || new Date().toISOString(),
    })),
  });
}
