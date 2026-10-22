export type ProviderId = "gmail" | "outlook" | "yahoo" | "icloud" | "custom";

export type EmailAccountPublic = {
  id: number;
  label: string;
  email: string;
  provider: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  color: string;
  isDemo: boolean;
  unreadCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
};

export type EmailListItem = {
  id: number;
  accountId: number;
  accountLabel: string;
  accountColor: string;
  accountEmail: string;
  messageId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  snippet: string;
  isStarred: boolean;
  isRead: boolean;
  receivedAt: string;
};

export type EmailDetail = EmailListItem & {
  cc: string;
  bodyText: string;
  bodyHtml: string;
};

export type VaultMessage = {
  id: number;
  kind: "text" | "image" | "file" | "code" | "link";
  content: string;
  fileName: string | null;
  fileMime: string | null;
  fileData: string | null;
  createdAt: string;
};

export type ServerPreset = {
  id: ProviderId;
  name: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  hint: string;
  color: string;
};
