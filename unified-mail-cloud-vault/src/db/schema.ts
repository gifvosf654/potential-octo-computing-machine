import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  provider: varchar("provider", { length: 40 }).notNull().default("custom"),
  imapHost: varchar("imap_host", { length: 255 }).notNull(),
  imapPort: integer("imap_port").notNull().default(993),
  imapSecure: boolean("imap_secure").notNull().default(true),
  smtpHost: varchar("smtp_host", { length: 255 }).notNull(),
  smtpPort: integer("smtp_port").notNull().default(465),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  password: text("password").notNull().default(""),
  color: varchar("color", { length: 16 }).notNull().default("#007AFF"),
  isDemo: boolean("is_demo").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emails = pgTable(
  "emails",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => emailAccounts.id, { onDelete: "cascade" }),
    messageId: varchar("message_id", { length: 512 }).notNull(),
    fromName: varchar("from_name", { length: 255 }).notNull().default(""),
    fromEmail: varchar("from_email", { length: 320 }).notNull().default(""),
    toEmail: varchar("to_email", { length: 320 }).notNull().default(""),
    cc: text("cc").notNull().default(""),
    subject: text("subject").notNull().default("(No subject)"),
    snippet: text("snippet").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html").notNull().default(""),
    isStarred: boolean("is_starred").notNull().default(false),
    isRead: boolean("is_read").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountMessage: uniqueIndex("emails_account_message_idx").on(
      table.accountId,
      table.messageId,
    ),
    receivedAtIdx: index("emails_received_at_idx").on(table.receivedAt),
    accountIdx: index("emails_account_id_idx").on(table.accountId),
  }),
);

export const vaultMessages = pgTable(
  "vault_messages",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 20 }).notNull().default("text"),
    content: text("content").notNull().default(""),
    fileName: varchar("file_name", { length: 255 }),
    fileMime: varchar("file_mime", { length: 120 }),
    fileData: text("file_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("vault_messages_created_at_idx").on(table.createdAt),
  }),
);
