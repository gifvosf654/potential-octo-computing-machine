"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VaultPane } from "./VaultPane";
import { formatFullDate, formatThreadTime, initials, sanitizeHtml, textToHtml } from "@/lib/format";
import { SERVER_PRESETS } from "@/lib/presets";
import type { EmailAccountPublic, EmailDetail, EmailListItem, VaultMessage } from "@/lib/types";

type View = "unified" | "starred" | "vault" | number;

type Toast = { text: string; tone: "ok" | "warn" };

const EMPTY_ACCOUNT_FORM = {
  label: "",
  email: "",
  password: "",
  provider: "gmail",
  imapHost: "imap.gmail.com",
  imapPort: 993,
  imapSecure: true,
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpSecure: true,
  showAdvanced: false,
};

export function MailApp({ onLock }: { onLock: () => void }) {
  const [accounts, setAccounts] = useState<EmailAccountPublic[]>([]);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [vault, setVault] = useState<VaultMessage[]>([]);
  const [view, setView] = useState<View>("unified");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [mobilePane, setMobilePane] = useState<"sidebar" | "list" | "reader">("list");
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountSaving, setAccountSaving] = useState(false);
  const [compose, setCompose] = useState({ accountId: 0, to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const notify = useCallback((text: string, tone: "ok" | "warn" = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/accounts", { cache: "no-store" });
    const data = (await response.json()) as { accounts: EmailAccountPublic[] };
    setAccounts(data.accounts || []);
  }, []);

  const loadEmails = useCallback(async () => {
    const response = await fetch("/api/emails", { cache: "no-store" });
    const data = (await response.json()) as { emails: EmailListItem[] };
    setEmails((data.emails || []) as EmailListItem[]);
  }, []);

  const loadVault = useCallback(async () => {
    const response = await fetch("/api/vault", { cache: "no-store" });
    const data = (await response.json()) as { messages: VaultMessage[] };
    setVault((data.messages || []) as VaultMessage[]);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAccounts(), loadEmails(), loadVault()]);
  }, [loadAccounts, loadEmails, loadVault]);

  useEffect(() => {
    void refreshAll();
    const timer = window.setInterval(() => {
      void refreshAll();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshAll]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        onLock();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openCompose();
      }
      if (event.key === "Escape") {
        setComposeOpen(false);
        setAccountOpen(false);
        setPreview(null);
        setConfirmId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLock, accounts, view]);

  const unreadTotal = useMemo(
    () => accounts.reduce((sum, account) => sum + account.unreadCount, 0),
    [accounts],
  );
  const starredCount = useMemo(() => emails.filter((email) => email.isStarred).length, [emails]);

  const visibleEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    return emails.filter((email) => {
      if (view === "starred" && !email.isStarred) return false;
      if (typeof view === "number" && email.accountId !== view) return false;
      if (view === "vault") return false;
      if (!query) return true;
      return [email.subject, email.fromName, email.fromEmail, email.snippet]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [emails, search, view]);

  async function openEmail(id: number) {
    setSelectedId(id);
    setMobilePane("reader");
    setEmails((current) => current.map((email) => (email.id === id ? { ...email, isRead: true } : email)));
    setAccounts((current) =>
      current.map((account) => {
        const email = emails.find((item) => item.id === id);
        if (!email || email.isRead || email.accountId !== account.id) return account;
        return { ...account, unreadCount: Math.max(0, account.unreadCount - 1) };
      }),
    );
    const response = await fetch(`/api/emails/${id}`, { cache: "no-store" });
    const data = (await response.json()) as { email?: EmailDetail };
    if (data.email) setDetail(data.email);
  }

  async function patchEmail(id: number, patch: { isStarred?: boolean; isDeleted?: boolean; isRead?: boolean }) {
    setEmails((current) =>
      current
        .map((email) => (email.id === id ? { ...email, ...patch } : email))
        .filter((email) => !patch.isDeleted || email.id !== id),
    );
    if (detail?.id === id) {
      if (patch.isDeleted) {
        setDetail(null);
        setSelectedId(null);
      } else {
        setDetail({ ...detail, ...patch });
      }
    }
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (patch.isDeleted || patch.isRead === false) void loadAccounts();
  }

  function openCompose(reply?: EmailDetail | EmailListItem) {
    const fallbackId =
      typeof view === "number" ? view : reply?.accountId || accounts[0]?.id || 0;
    if (reply) {
      setCompose({
        accountId: reply.accountId,
        to: reply.fromEmail,
        subject: reply.subject.startsWith("Re:") ? reply.subject : `Re: ${reply.subject}`,
        body: `\n\nOn ${formatFullDate(reply.receivedAt)}, ${reply.fromName || reply.fromEmail} wrote:\n> ${reply.snippet}`,
      });
    } else {
      setCompose({ accountId: fallbackId, to: "", subject: "", body: "" });
    }
    setComposeOpen(true);
  }

  async function sendMail() {
    setSending(true);
    try {
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compose),
      });
      const data = (await response.json()) as { error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error || "Send failed");
      setComposeOpen(false);
      notify(data.warning || "Message sent");
      await loadEmails();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Send failed", "warn");
    } finally {
      setSending(false);
    }
  }

  async function syncAll() {
    setSyncing(true);
    try {
      const targets = accounts.filter((account) => !account.isDemo);
      if (!targets.length) {
        notify("Demo inboxes are already up to date");
        await refreshAll();
        return;
      }
      let imported = 0;
      for (const account of targets) {
        const response = await fetch(`/api/accounts/${account.id}/sync`, { method: "POST" });
        const data = (await response.json()) as { imported?: number; warning?: string };
        imported += data.imported || 0;
        if (data.warning) notify(data.warning, "warn");
      }
      await refreshAll();
      notify(imported ? `Imported ${imported} new messages` : "Inbox is up to date");
    } finally {
      setSyncing(false);
    }
  }

  function applyPreset(id: string) {
    const preset = SERVER_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setAccountForm((current) => ({
      ...current,
      provider: preset.id,
      imapHost: preset.imapHost,
      imapPort: preset.imapPort,
      imapSecure: preset.imapSecure,
      smtpHost: preset.smtpHost,
      smtpPort: preset.smtpPort,
      smtpSecure: preset.smtpSecure,
    }));
  }

  async function saveAccount() {
    setAccountSaving(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      const data = (await response.json()) as {
        error?: string;
        warning?: string;
        imported?: number;
      };
      if (!response.ok) throw new Error(data.error || "Could not add account");
      setAccountOpen(false);
      setAccountForm(EMPTY_ACCOUNT_FORM);
      await refreshAll();
      if (data.warning) notify(data.warning, "warn");
      else notify(data.imported ? `Connected · ${data.imported} messages` : "Account added");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add account", "warn");
    } finally {
      setAccountSaving(false);
    }
  }

  async function removeAccount(id: number) {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    setConfirmId(null);
    if (view === id) setView("unified");
    await refreshAll();
    notify("Account removed");
  }

  const html = detail
    ? detail.bodyHtml
      ? sanitizeHtml(detail.bodyHtml)
      : textToHtml(detail.bodyText || detail.snippet)
    : "";

  const navBtn = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[13px] transition ${
      active ? "bg-white/80 font-semibold shadow-sm" : "hover:bg-white/45"
    }`;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/wallpaper.jpg)" }}
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-0 sm:p-4">
        <div className="mail-window rise-in flex h-[100dvh] w-full max-w-[1460px] flex-col overflow-hidden rounded-none sm:h-[min(920px,calc(100dvh-28px))] sm:rounded-[18px]">
          <header className="flex items-center gap-3 border-b border-black/8 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-3 w-3 rounded-full bg-[#ff5f57]"
                onClick={onLock}
                aria-label="Lock"
              />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <button
              type="button"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-black/60 hover:bg-black/5 lg:hidden"
              onClick={() => setMobilePane((pane) => (pane === "sidebar" ? "list" : "sidebar"))}
            >
              <i className="fa-solid fa-bars" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/mail-icon.png" alt="" className="hidden h-6 w-6 rounded-[7px] sm:block" />
            <p className="text-[13px] font-semibold tracking-tight">Mail</p>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void syncAll()}
                className="flex h-8 items-center gap-2 rounded-full px-3 text-[12px] text-black/60 hover:bg-black/5"
              >
                <i className={`fa-solid fa-arrow-rotate-right ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
              <button
                type="button"
                onClick={() => openCompose()}
                className="flex h-8 items-center gap-2 rounded-full bg-[#007aff] px-3 text-[12px] font-medium text-white"
              >
                <i className="fa-solid fa-pen-to-square" />
                Compose
              </button>
              <button
                type="button"
                onClick={onLock}
                className="flex h-8 items-center gap-2 rounded-full px-3 text-[12px] text-black/60 hover:bg-black/5"
                title="Lock Vault (Ctrl/Cmd+L)"
              >
                <i className="fa-solid fa-lock" />
                Lock
              </button>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1">
            <aside
              className={`sidebar-glass absolute inset-y-0 left-0 z-20 w-[248px] shrink-0 flex-col border-r border-black/8 p-3 lg:static lg:flex ${
                mobilePane === "sidebar" ? "flex" : "hidden"
              }`}
            >
              <nav className="space-y-1">
                <button type="button" className={navBtn(view === "unified")} onClick={() => { setView("unified"); setMobilePane("list"); }}>
                  <i className="fa-solid fa-inbox w-4 text-[#007aff]" />
                  Unified Inbox
                  {unreadTotal ? (
                    <span className="ml-auto rounded-full bg-[#007aff] px-1.5 text-[10px] font-semibold text-white">
                      {unreadTotal}
                    </span>
                  ) : null}
                </button>
                <button type="button" className={navBtn(view === "starred")} onClick={() => { setView("starred"); setMobilePane("list"); }}>
                  <i className="fa-solid fa-star w-4 text-[#ffcc00]" />
                  Starred
                  <span className="ml-auto text-[11px] text-black/35">{starredCount}</span>
                </button>
                <button type="button" className={navBtn(view === "vault")} onClick={() => { setView("vault"); setMobilePane("reader"); }}>
                  <i className="fa-solid fa-bookmark w-4 text-[#af52de]" />
                  Saved Vault
                </button>
              </nav>

              <p className="mt-5 mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-black/35 uppercase">
                Accounts
              </p>
              <div className="thin-scroll space-y-1 overflow-y-auto">
                {accounts.map((account) => (
                  <div key={account.id} className="group relative">
                    <button
                      type="button"
                      className={navBtn(view === account.id)}
                      onClick={() => {
                        setView(account.id);
                        setMobilePane("list");
                      }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: account.color }} />
                      <span className="min-w-0 flex-1 truncate">
                        {account.label}
                        <span className="block truncate text-[11px] font-normal text-black/40">
                          {account.email}
                        </span>
                      </span>
                      {account.unreadCount ? (
                        <span className="rounded-full bg-black/70 px-1.5 text-[10px] font-semibold text-white">
                          {account.unreadCount}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="absolute top-2 right-2 hidden h-6 w-6 items-center justify-center rounded-full text-black/30 hover:bg-black/10 group-hover:flex"
                      onClick={() => setConfirmId(account.id)}
                      aria-label="Remove account"
                    >
                      <i className="fa-solid fa-xmark text-[11px]" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-1 pt-3">
                <button
                  type="button"
                  className={navBtn(false)}
                  onClick={() => {
                    setAccountForm(EMPTY_ACCOUNT_FORM);
                    setAccountOpen(true);
                  }}
                >
                  <i className="fa-solid fa-circle-plus w-4 text-[#34c759]" />
                  Add Account
                </button>
                <p className="px-3 pt-2 text-[10px] leading-relaxed text-black/35">
                  Ctrl/Cmd+L locks the vault · Ctrl/Cmd+N composes
                </p>
              </div>
            </aside>

            {view === "vault" ? (
              <VaultPane
                messages={vault}
                onRefresh={loadVault}
                onToast={notify}
                onPreview={setPreview}
              />
            ) : (
              <>
                <section
                  className={`thread-glass min-w-0 flex-col border-r border-black/8 lg:flex lg:w-[360px] lg:shrink-0 ${
                    mobilePane === "list" ? "flex flex-1" : "hidden"
                  }`}
                >
                  <div className="border-b border-black/8 px-4 py-3">
                    <h2 className="mb-2 text-[17px] font-semibold tracking-tight">
                      {view === "starred"
                        ? "Starred"
                        : typeof view === "number"
                          ? accounts.find((account) => account.id === view)?.label || "Mailbox"
                          : "All Inboxes"}
                    </h2>
                    <div className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1.5">
                      <i className="fa-solid fa-magnifying-glass text-[11px] text-black/35" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search mail"
                        className="w-full bg-transparent text-[13px] outline-none"
                      />
                    </div>
                  </div>
                  <div className="thin-scroll flex-1 overflow-y-auto">
                    {visibleEmails.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-black/40">
                        <i className="fa-regular fa-envelope mb-3 text-3xl" />
                        <p className="text-sm">No messages</p>
                      </div>
                    ) : (
                      visibleEmails.map((email) => (
                        <button
                          key={email.id}
                          type="button"
                          onClick={() => void openEmail(email.id)}
                          className={`flex w-full gap-3 border-b border-black/5 px-4 py-3 text-left transition ${
                            selectedId === email.id ? "bg-[#007aff]/12" : "hover:bg-black/4"
                          }`}
                        >
                          <div className="relative mt-0.5 shrink-0">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                              style={{ background: email.accountColor }}
                            >
                              {initials(email.fromName, email.fromEmail)}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span
                                className={`truncate text-[13px] ${
                                  email.isRead ? "font-medium text-black/65" : "font-semibold"
                                }`}
                              >
                                {email.fromName || email.fromEmail}
                              </span>
                              <span className="ml-auto shrink-0 text-[11px] text-black/35">
                                {formatThreadTime(email.receivedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p
                                className={`truncate text-[13px] ${
                                  email.isRead ? "text-black/55" : "text-black"
                                }`}
                              >
                                {email.subject}
                              </p>
                              {email.isStarred ? (
                                <i className="fa-solid fa-star text-[10px] text-[#ffcc00]" />
                              ) : null}
                            </div>
                            <p className="truncate text-[12px] text-black/40">{email.snippet}</p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-black/35">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: email.accountColor }} />
                              {email.accountLabel}
                            </p>
                          </div>
                          {!email.isRead ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#007aff]" /> : null}
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section
                  className={`reader-glass min-w-0 flex-1 flex-col ${
                    mobilePane === "reader" ? "flex" : "hidden lg:flex"
                  }`}
                >
                  {detail ? (
                    <>
                      <div className="flex items-start gap-3 border-b border-black/8 px-5 py-4">
                        <button
                          type="button"
                          className="mt-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 lg:hidden"
                          onClick={() => setMobilePane("list")}
                        >
                          <i className="fa-solid fa-chevron-left" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[20px] leading-tight font-semibold tracking-tight">
                            {detail.subject}
                          </h3>
                          <div className="mt-3 flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                              style={{ background: detail.accountColor }}
                            >
                              {initials(detail.fromName, detail.fromEmail)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium">
                                {detail.fromName || detail.fromEmail}
                                <span className="ml-2 font-normal text-black/40">{detail.fromEmail}</span>
                              </p>
                              <p className="text-[12px] text-black/45">
                                to {detail.toEmail || detail.accountEmail} · {formatFullDate(detail.receivedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-9 rounded-full px-3 text-[12px] font-medium text-[#007aff] hover:bg-[#007aff]/10"
                            onClick={() => openCompose(detail)}
                          >
                            Reply
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
                            onClick={() => void patchEmail(detail.id, { isStarred: !detail.isStarred })}
                          >
                            <i className={`${detail.isStarred ? "fa-solid text-[#ffcc00]" : "fa-regular text-black/50"} fa-star`} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-black/50 hover:bg-black/5"
                            onClick={() => void patchEmail(detail.id, { isDeleted: true })}
                          >
                            <i className="fa-regular fa-trash-can" />
                          </button>
                        </div>
                      </div>
                      <div className="thin-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-8">
                        <iframe
                          title="Email body"
                          sandbox="allow-same-origin allow-popups"
                          className="min-h-[280px] w-full rounded-2xl bg-white"
                          srcDoc={html}
                          onLoad={(event) => {
                            const iframe = event.currentTarget;
                            try {
                              const height = iframe.contentDocument?.documentElement.scrollHeight;
                              if (height) iframe.style.height = `${Math.min(Math.max(height + 24, 240), 2400)}px`;
                            } catch {
                              iframe.style.height = "480px";
                            }
                          }}
                        />
                      </div>
                      <div className="border-t border-black/8 px-5 py-3">
                        <button
                          type="button"
                          className="w-full rounded-2xl bg-black/4 px-4 py-3 text-left text-[13px] text-black/40 hover:bg-black/6"
                          onClick={() => openCompose(detail)}
                        >
                          Reply as {detail.accountEmail}…
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-black/35">
                      <i className="fa-regular fa-paper-plane mb-3 text-4xl" />
                      <p className="text-sm">Select a message to read</p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {toast ? (
        <div
          className={`glass-panel fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-medium ${
            toast.tone === "warn" ? "text-[#c93400]" : "text-black/80"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      {preview ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="max-h-full max-w-full rounded-2xl shadow-2xl" />
        </button>
      ) : null}

      {composeOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="glass-panel w-full max-w-xl rounded-[22px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">New Message</h3>
              <button type="button" onClick={() => setComposeOpen(false)} className="text-black/40">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <label className="mb-3 flex items-center gap-3 border-b border-black/8 pb-2 text-[13px]">
              <span className="w-12 text-black/40">From</span>
              <select
                value={compose.accountId}
                onChange={(event) =>
                  setCompose((current) => ({ ...current, accountId: Number(event.target.value) }))
                }
                className="flex-1 bg-transparent outline-none"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} · {account.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-3 flex items-center gap-3 border-b border-black/8 pb-2 text-[13px]">
              <span className="w-12 text-black/40">To</span>
              <input
                value={compose.to}
                onChange={(event) => setCompose((current) => ({ ...current, to: event.target.value }))}
                className="flex-1 bg-transparent outline-none"
                placeholder="name@email.com"
              />
            </label>
            <label className="mb-3 flex items-center gap-3 border-b border-black/8 pb-2 text-[13px]">
              <span className="w-12 text-black/40">Subject</span>
              <input
                value={compose.subject}
                onChange={(event) =>
                  setCompose((current) => ({ ...current, subject: event.target.value }))
                }
                className="flex-1 bg-transparent outline-none"
                placeholder="Subject"
              />
            </label>
            <textarea
              value={compose.body}
              onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))}
              rows={10}
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none"
              placeholder="Write your message…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-[13px] text-black/50"
                onClick={() => setComposeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void sendMail()}
                className="rounded-full bg-[#007aff] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accountOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="glass-panel max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[22px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">Add Email Account</h3>
              <button type="button" onClick={() => setAccountOpen(false)} className="text-black/40">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {SERVER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                    accountForm.provider === preset.id
                      ? "bg-black text-white"
                      : "bg-black/5 text-black/70"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <p className="mb-4 text-[12px] text-black/45">
              {SERVER_PRESETS.find((preset) => preset.id === accountForm.provider)?.hint}
            </p>
            <div className="space-y-3">
              <input
                value={accountForm.label}
                onChange={(event) => setAccountForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Account name"
                className="w-full rounded-2xl bg-black/5 px-4 py-3 text-[14px] outline-none"
              />
              <input
                value={accountForm.email}
                onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email address"
                className="w-full rounded-2xl bg-black/5 px-4 py-3 text-[14px] outline-none"
              />
              <input
                type="password"
                value={accountForm.password}
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="App password"
                className="w-full rounded-2xl bg-black/5 px-4 py-3 text-[14px] outline-none"
              />
              <button
                type="button"
                className="text-[12px] font-medium text-[#007aff]"
                onClick={() =>
                  setAccountForm((current) => ({ ...current, showAdvanced: !current.showAdvanced }))
                }
              >
                {accountForm.showAdvanced ? "Hide server settings" : "Server settings"}
              </button>
              {accountForm.showAdvanced ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={accountForm.imapHost}
                    onChange={(event) =>
                      setAccountForm((current) => ({ ...current, imapHost: event.target.value }))
                    }
                    placeholder="IMAP host"
                    className="col-span-2 rounded-2xl bg-black/5 px-4 py-3 text-[13px] outline-none"
                  />
                  <input
                    type="number"
                    value={accountForm.imapPort}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        imapPort: Number(event.target.value),
                      }))
                    }
                    className="rounded-2xl bg-black/5 px-4 py-3 text-[13px] outline-none"
                  />
                  <input
                    value={accountForm.smtpHost}
                    onChange={(event) =>
                      setAccountForm((current) => ({ ...current, smtpHost: event.target.value }))
                    }
                    placeholder="SMTP host"
                    className="col-span-2 rounded-2xl bg-black/5 px-4 py-3 text-[13px] outline-none"
                  />
                  <input
                    type="number"
                    value={accountForm.smtpPort}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        smtpPort: Number(event.target.value),
                      }))
                    }
                    className="rounded-2xl bg-black/5 px-4 py-3 text-[13px] outline-none"
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-[13px] text-black/50"
                onClick={() => setAccountOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={accountSaving}
                onClick={() => void saveAccount()}
                className="rounded-full bg-[#007aff] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {accountSaving ? "Connecting…" : "Add Account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="glass-panel w-full max-w-sm rounded-[22px] p-5 text-center">
            <p className="text-[16px] font-semibold">Remove this account?</p>
            <p className="mt-2 text-[13px] text-black/50">
              Its cached messages will be deleted from this vault.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-[13px]"
                onClick={() => setConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-[#ff3b30] px-4 py-2 text-[13px] font-medium text-white"
                onClick={() => void removeAccount(confirmId)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
