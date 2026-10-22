import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, emails } from "@/db/schema";

type AccountRow = typeof emailAccounts.$inferSelect;

function snippetFrom(text: string, html: string): string {
  const raw =
    text.trim() ||
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  return raw.replace(/\s+/g, " ").trim().slice(0, 220);
}

export async function syncImapAccount(accountId: number): Promise<{
  imported: number;
  warning?: string;
}> {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  if (account.isDemo) {
    await db
      .update(emailAccounts)
      .set({ lastSyncedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));
    return { imported: 0 };
  }

  if (!account.password) {
    return { imported: 0, warning: "Missing app password for this account." };
  }

  try {
    const imported = await Promise.race([
      fetchImapMessages(account),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("IMAP connection timed out")), 25000);
      }),
    ]);

    await db
      .update(emailAccounts)
      .set({ lastSyncedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));

    return { imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAP sync failed";
    return { imported: 0, warning: message };
  }
}

async function fetchImapMessages(account: AccountRow): Promise<number> {
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");

  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
      user: account.email,
      pass: account.password,
    },
    logger: false,
  });

  let imported = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const total = mailbox && typeof mailbox.exists === "number" ? mailbox.exists : 0;
      if (!total) return 0;

      const start = Math.max(1, total - 39);
      for await (const msg of client.fetch(`${start}:${total}`, {
        envelope: true,
        source: true,
        uid: true,
      })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const from = parsed.from?.value?.[0];
        const to = parsed.to
          ? (Array.isArray(parsed.to)
              ? parsed.to
              : [parsed.to]
            )
              .flatMap((item) => item.value || [])
              .map((item) => item.address || "")
              .filter(Boolean)
              .join(", ")
          : account.email;
        const html = typeof parsed.html === "string" ? parsed.html : "";
        const text = parsed.text || "";
        const subject = parsed.subject || "(No subject)";
        const messageId =
          parsed.messageId ||
          msg.envelope?.messageId ||
          `imap-${account.id}-${msg.uid}`;

        const inserted = await db
          .insert(emails)
          .values({
            accountId: account.id,
            messageId: String(messageId).slice(0, 512),
            fromName: (from?.name || "").slice(0, 255),
            fromEmail: (from?.address || "").slice(0, 320),
            toEmail: to.slice(0, 320),
            cc: "",
            subject,
            snippet: snippetFrom(text, html),
            bodyText: text,
            bodyHtml: html,
            receivedAt:
            parsed.date instanceof Date
              ? parsed.date
              : msg.envelope?.date instanceof Date
                ? msg.envelope.date
                : new Date(),
          })
          .onConflictDoNothing()
          .returning({ id: emails.id });

        if (inserted.length) imported += 1;
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  return imported;
}

export async function sendSmtpMail(input: {
  accountId: number;
  to: string;
  subject: string;
  body: string;
}): Promise<{ warning?: string }> {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, input.accountId))
    .limit(1);

  if (!account) throw new Error("Account not found");

  const html = input.body.replace(/\n/g, "<br>");
  const messageId = `<sent-${Date.now()}-${Math.random().toString(36).slice(2)}@vault.local>`;

  await db.insert(emails).values({
    accountId: account.id,
    messageId,
    fromName: account.label,
    fromEmail: account.email,
    toEmail: input.to,
    subject: input.subject || "(No subject)",
    snippet: snippetFrom(input.body, html),
    bodyText: input.body,
    bodyHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f">${html}</div>`,
    isRead: true,
    receivedAt: new Date(),
  });

  if (account.isDemo || !account.password) {
    return {
      warning: account.isDemo
        ? "Saved locally on the demo account. Add a real IMAP/SMTP account to deliver mail."
        : undefined,
    };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      auth: {
        user: account.email,
        pass: account.password,
      },
    });

    await Promise.race([
      transporter.sendMail({
        from: `"${account.label}" <${account.email}>`,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("SMTP timed out")), 20000);
      }),
    ]);

    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    return { warning: `Saved to inbox, but SMTP delivery failed: ${message}` };
  }
}
