import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, emails } from "@/db/schema";
import { ACCOUNT_COLORS, iso } from "@/lib/presets";
import { ensureSeedData } from "@/lib/seed";
import { syncImapAccount } from "@/lib/mail";
import type { EmailAccountPublic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serialize(
  row: typeof emailAccounts.$inferSelect,
  unreadCount: number,
): EmailAccountPublic {
  return {
    id: row.id,
    label: row.label,
    email: row.email,
    provider: row.provider,
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    imapSecure: row.imapSecure,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    color: row.color,
    isDemo: row.isDemo,
    unreadCount,
    lastSyncedAt: iso(row.lastSyncedAt),
    createdAt: iso(row.createdAt) || new Date().toISOString(),
  };
}

export async function GET() {
  await ensureSeedData();

  const accounts = await db.select().from(emailAccounts).orderBy(emailAccounts.createdAt);
  const unreadRows = await db
    .select({
      accountId: emails.accountId,
      count: sql<number>`count(*)::int`,
    })
    .from(emails)
    .where(and(eq(emails.isDeleted, false), eq(emails.isRead, false)))
    .groupBy(emails.accountId);

  const unreadByAccount = new Map<number, number>();
  for (const row of unreadRows) {
    unreadByAccount.set(row.accountId, Number(row.count || 0));
  }

  return Response.json({
    accounts: accounts.map((account) =>
      serialize(account, unreadByAccount.get(account.id) || 0),
    ),
  });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = (await request.json()) as {
    label?: string;
    email?: string;
    provider?: string;
    imapHost?: string;
    imapPort?: number;
    imapSecure?: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    password?: string;
    color?: string;
  };

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (!body.imapHost || !body.smtpHost) {
    return Response.json({ error: "IMAP and SMTP hosts are required." }, { status: 400 });
  }

  const existing = await db.select({ id: emailAccounts.id }).from(emailAccounts);
  const color =
    body.color || ACCOUNT_COLORS[existing.length % ACCOUNT_COLORS.length] || "#007AFF";

  const [created] = await db
    .insert(emailAccounts)
    .values({
      label: (body.label || email.split("@")[0] || "Account").trim(),
      email,
      provider: body.provider || "custom",
      imapHost: body.imapHost.trim(),
      imapPort: Number(body.imapPort || 993),
      imapSecure: body.imapSecure !== false,
      smtpHost: body.smtpHost.trim(),
      smtpPort: Number(body.smtpPort || 465),
      smtpSecure: body.smtpSecure !== false,
      password: body.password || "",
      color,
      isDemo: false,
    })
    .returning();

  const syncResult = await syncImapAccount(created.id);

  return Response.json({
    account: serialize(created, 0),
    imported: syncResult.imported,
    warning: syncResult.warning,
  });
}
