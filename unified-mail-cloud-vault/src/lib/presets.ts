import type { ServerPreset } from "./types";

export const ACCOUNT_COLORS = [
  "#007AFF",
  "#FF3B30",
  "#34C759",
  "#FF9500",
  "#AF52DE",
  "#5AC8FA",
  "#FF2D55",
  "#5856D6",
];

export const SERVER_PRESETS: ServerPreset[] = [
  {
    id: "gmail",
    name: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Use a Google App Password, not your regular password.",
    color: "#EA4335",
  },
  {
    id: "outlook",
    name: "Outlook",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Works with Outlook, Hotmail, and Microsoft 365.",
    color: "#0A66C2",
  },
  {
    id: "yahoo",
    name: "Yahoo",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Generate an app password in Yahoo Account Security.",
    color: "#6001D2",
  },
  {
    id: "icloud",
    name: "iCloud",
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "Use an app-specific password from appleid.apple.com.",
    color: "#8E8E93",
  },
  {
    id: "custom",
    name: "Custom",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Enter IMAP and SMTP servers for your domain.",
    color: "#007AFF",
  },
];

export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
