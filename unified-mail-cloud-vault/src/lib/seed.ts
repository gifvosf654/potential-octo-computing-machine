import { db } from "@/db";
import { emailAccounts, emails, vaultMessages } from "@/db/schema";

function minutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60_000);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

const wrap = (inner: string) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1d1d1f;max-width:560px">${inner}</div>`;

export async function ensureSeedData() {
  const existing = await db.select({ id: emailAccounts.id }).from(emailAccounts).limit(1);
  if (existing.length) return;

  const [personal] = await db
    .insert(emailAccounts)
    .values({
      label: "Personal",
      email: "you@icloud.com",
      provider: "icloud",
      imapHost: "imap.mail.me.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.mail.me.com",
      smtpPort: 587,
      smtpSecure: false,
      password: "",
      color: "#007AFF",
      isDemo: true,
      lastSyncedAt: new Date(),
    })
    .returning();

  const [work] = await db
    .insert(emailAccounts)
    .values({
      label: "Work",
      email: "you@company.com",
      provider: "gmail",
      imapHost: "imap.gmail.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      password: "",
      color: "#FF3B30",
      isDemo: true,
      lastSyncedAt: new Date(),
    })
    .returning();

  if (!personal || !work) return;

  await db.insert(emails).values([
    {
      accountId: personal.id,
      messageId: "<welcome-apple@icloud.demo>",
      fromName: "Tim Cook",
      fromEmail: "tcook@apple.com",
      toEmail: "you@icloud.com",
      subject: "Welcome to your Unified Mail",
      snippet:
        "Your personal and work inboxes now live in one beautifully simple place — just like they should.",
      bodyText:
        "Welcome to Unified Mail. Your personal and work inboxes now live in one beautifully simple place. Star what matters, reply from the right account, and keep private notes in the vault.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Welcome to Unified Mail.</p><p style="margin:0 0 12px">Your personal and work inboxes now live in one beautifully simple place. Star what matters, reply from the exact account that received a message, and keep private notes in Saved Vault.</p><p style="margin:0;color:#6e6e73">— Tim</p>`,
      ),
      isStarred: true,
      isRead: false,
      receivedAt: minutesAgo(8),
    },
    {
      accountId: personal.id,
      messageId: "<photos-memory@icloud.demo>",
      fromName: "iCloud Photos",
      fromEmail: "noreply@icloud.com",
      toEmail: "you@icloud.com",
      subject: "Your memories from Lake Tahoe",
      snippet: "A few photos from this time last year are ready to revisit.",
      bodyText:
        "A few photos from this time last year are ready to revisit in iCloud Photos. Open the Photos app to see your Lake Tahoe memories.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">A few photos from this time last year are ready to revisit.</p><p style="margin:0;color:#6e6e73">Open Photos to see your Lake Tahoe memories.</p>`,
      ),
      isRead: false,
      receivedAt: minutesAgo(42),
    },
    {
      accountId: personal.id,
      messageId: "<calendar-dinner@icloud.demo>",
      fromName: "Calendar",
      fromEmail: "calendar@icloud.com",
      toEmail: "you@icloud.com",
      subject: "Dinner with Maya · Tonight 7:30 PM",
      snippet: "At Bar Isabel. Reservation is under your name.",
      bodyText: "Dinner with Maya tonight at 7:30 PM at Bar Isabel. Reservation is under your name.",
      bodyHtml: wrap(
        `<p style="margin:0 0 8px"><strong>Dinner with Maya</strong></p><p style="margin:0 0 8px">Tonight · 7:30 PM</p><p style="margin:0;color:#6e6e73">Bar Isabel · Reservation under your name</p>`,
      ),
      isStarred: true,
      isRead: true,
      receivedAt: hoursAgo(3),
    },
    {
      accountId: personal.id,
      messageId: "<family-note@icloud.demo>",
      fromName: "Mom",
      fromEmail: "mom@icloud.com",
      toEmail: "you@icloud.com",
      subject: "Sunday brunch?",
      snippet: "Can you bring the pastry box from that bakery you like? Love you.",
      bodyText:
        "Hi sweetheart — are you still free for Sunday brunch? Can you bring the pastry box from that bakery you like? Love you.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Hi sweetheart — are you still free for Sunday brunch?</p><p style="margin:0 0 12px">Can you bring the pastry box from that bakery you like?</p><p style="margin:0">Love you.</p>`,
      ),
      isRead: true,
      receivedAt: hoursAgo(9),
    },
    {
      accountId: personal.id,
      messageId: "<spotify-wrap@icloud.demo>",
      fromName: "Spotify",
      fromEmail: "no-reply@spotify.com",
      toEmail: "you@icloud.com",
      subject: "Your Discover Weekly is in",
      snippet: "Thirty new tracks picked for a late-night drive.",
      bodyText: "Your Discover Weekly is ready. Thirty new tracks picked for a late-night drive.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Your Discover Weekly is ready.</p><p style="margin:0;color:#6e6e73">Thirty new tracks picked for a late-night drive.</p>`,
      ),
      isRead: true,
      receivedAt: daysAgo(1),
    },
    {
      accountId: personal.id,
      messageId: "<apple-card@icloud.demo>",
      fromName: "Apple Card",
      fromEmail: "applecard@apple.com",
      toEmail: "you@icloud.com",
      subject: "Your April statement is ready",
      snippet: "Daily Cash this month: $27.40. Total balance $184.12.",
      bodyText: "Your April statement is ready. Daily Cash this month: $27.40. Total balance $184.12.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Your April statement is ready.</p><p style="margin:0">Daily Cash this month: <strong>$27.40</strong></p><p style="margin:8px 0 0;color:#6e6e73">Total balance $184.12</p>`,
      ),
      isRead: true,
      receivedAt: daysAgo(2),
    },
    {
      accountId: personal.id,
      messageId: "<news-letter@icloud.demo>",
      fromName: "The Morning",
      fromEmail: "editor@morning.co",
      toEmail: "you@icloud.com",
      subject: "A quieter internet, on purpose",
      snippet: "Why the best tools this year feel invisible — and a reading list for Sunday.",
      bodyText:
        "Why the best tools this year feel invisible — and a reading list for Sunday. Also: the case for leaving your phone in another room.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Why the best tools this year feel invisible — and a reading list for Sunday.</p><p style="margin:0;color:#6e6e73">Also: the case for leaving your phone in another room.</p>`,
      ),
      isRead: true,
      receivedAt: daysAgo(3),
    },
    {
      accountId: work.id,
      messageId: "<linear-issue@work.demo>",
      fromName: "Linear",
      fromEmail: "noreply@linear.app",
      toEmail: "you@company.com",
      subject: "[MAIL-204] Assign: polish the three-pane reader",
      snippet: "Maya assigned you this issue. Due Friday. Priority: High.",
      bodyText:
        "Maya assigned you MAIL-204: polish the three-pane reader. Due Friday. Priority: High. Include unread badges and instant search.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px"><strong>MAIL-204</strong> was assigned to you by Maya.</p><p style="margin:0 0 8px">Polish the three-pane reader. Include unread badges and instant search.</p><p style="margin:0;color:#6e6e73">Due Friday · Priority High</p>`,
      ),
      isRead: false,
      isStarred: true,
      receivedAt: minutesAgo(18),
    },
    {
      accountId: work.id,
      messageId: "<vercel-deploy@work.demo>",
      fromName: "Vercel",
      fromEmail: "notifications@vercel.com",
      toEmail: "you@company.com",
      subject: "Production deployment succeeded — mail-vault",
      snippet: "Ready on https://mail-vault.vercel.app  •  34s  •  main",
      bodyText:
        "Production deployment succeeded for mail-vault. Ready at https://mail-vault.vercel.app. Duration 34s on branch main.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Production deployment <strong style="color:#16a34a">succeeded</strong>.</p><p style="margin:0 0 8px">mail-vault · main · 34s</p><p style="margin:0;color:#007AFF">https://mail-vault.vercel.app</p>`,
      ),
      isRead: false,
      receivedAt: minutesAgo(55),
    },
    {
      accountId: work.id,
      messageId: "<github-pr@work.demo>",
      fromName: "GitHub",
      fromEmail: "notifications@github.com",
      toEmail: "you@company.com",
      subject: "Review requested: feat/unified-inbox #842",
      snippet: "alex wants you to review 18 files in company/mail",
      bodyText:
        "alex wants you to review pull request #842: feat/unified-inbox (18 files) in company/mail.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px"><strong>alex</strong> requested your review on <strong>#842</strong>.</p><p style="margin:0 0 8px">feat/unified-inbox · 18 files changed</p><p style="margin:0;color:#6e6e73">company/mail</p>`,
      ),
      isRead: false,
      receivedAt: hoursAgo(2),
    },
    {
      accountId: work.id,
      messageId: "<figma-comment@work.demo>",
      fromName: "Figma",
      fromEmail: "notifications@figma.com",
      toEmail: "you@company.com",
      subject: "New comments on Mail OS 18",
      snippet: "Priya: Can the PIN pad use the thicker glass material from Control Center?",
      bodyText:
        "Priya commented on Mail OS 18: Can the PIN pad use the thicker glass material from Control Center?",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px"><strong>Priya</strong> commented on Mail OS 18</p><p style="margin:0;padding:12px 14px;background:#f5f5f7;border-radius:12px">Can the PIN pad use the thicker glass material from Control Center?</p>`,
      ),
      isRead: true,
      receivedAt: hoursAgo(5),
    },
    {
      accountId: work.id,
      messageId: "<stripe-payout@work.demo>",
      fromName: "Stripe",
      fromEmail: "receipts@stripe.com",
      toEmail: "you@company.com",
      subject: "Payout of $4,280.00 is on its way",
      snippet: "It should arrive in your bank account tomorrow.",
      bodyText: "A payout of $4,280.00 is on its way. It should arrive in your bank account tomorrow.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">A payout of <strong>$4,280.00</strong> is on its way.</p><p style="margin:0;color:#6e6e73">It should arrive in your bank account tomorrow.</p>`,
      ),
      isRead: true,
      receivedAt: daysAgo(1),
    },
    {
      accountId: work.id,
      messageId: "<notion-digest@work.demo>",
      fromName: "Notion",
      fromEmail: "notify@notion.so",
      toEmail: "you@company.com",
      subject: "Weekly digest · Design Systems",
      snippet: "12 updates in Q2 Launch, including the new lock-screen spec.",
      bodyText:
        "You have 12 updates in Design Systems · Q2 Launch, including the new lock-screen spec.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">12 updates in <strong>Design Systems · Q2 Launch</strong>.</p><p style="margin:0;color:#6e6e73">Includes the new lock-screen spec.</p>`,
      ),
      isRead: true,
      receivedAt: daysAgo(2),
    },
    {
      accountId: work.id,
      messageId: "<hr-benefits@work.demo>",
      fromName: "People Ops",
      fromEmail: "people@company.com",
      toEmail: "you@company.com",
      subject: "Open enrollment closes Friday",
      snippet: "Please confirm your benefits selection in Workday before 5 PM.",
      bodyText:
        "Please confirm your benefits selection in Workday before 5 PM Friday. Open enrollment closes this week.",
      bodyHtml: wrap(
        `<p style="margin:0 0 12px">Please confirm your benefits selection in Workday before <strong>5 PM Friday</strong>.</p><p style="margin:0;color:#6e6e73">Open enrollment closes this week.</p>`,
      ),
      isStarred: true,
      isRead: true,
      receivedAt: daysAgo(4),
    },
  ]);

  await db.insert(vaultMessages).values([
    {
      kind: "text",
      content:
        "Welcome to Saved Vault — your private Telegram-style notebook. Drop files, paste screenshots with ⌘V, or stash a thought for later.",
      createdAt: daysAgo(5),
    },
    {
      kind: "code",
      content: `const unlock = (pin: string) => pin === "5109";\n\n// Quick lock from anywhere\nwindow.addEventListener("keydown", (e) => {\n  if ((e.metaKey || e.ctrlKey) && e.key === "l") lockVault();\n});`,
      createdAt: daysAgo(4),
    },
    {
      kind: "link",
      content: "https://developer.apple.com/design/human-interface-guidelines",
      createdAt: daysAgo(2),
    },
    {
      kind: "text",
      content: "Wi-Fi guest: Atlas-5G  ·  password in 1Password vault “Home”",
      createdAt: hoursAgo(6),
    },
  ]);
}
