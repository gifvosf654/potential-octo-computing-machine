"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VaultMessage } from "@/lib/types";
import { formatFullDate } from "@/lib/format";

type Props = {
  messages: VaultMessage[];
  onRefresh: () => Promise<void>;
  onToast: (text: string, tone?: "ok" | "warn") => void;
  onPreview: (src: string) => void;
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

async function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Invalid image"));
      image.src = url;
    });
    const max = 1400;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return readDataUrl(file);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VaultPane({ messages, onRefresh, onToast, onPreview }: Props) {
  const [text, setText] = useState("");
  const [codeMode, setCodeMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const grouped = useMemo(() => {
    const days: { label: string; items: VaultMessage[] }[] = [];
    for (const message of messages) {
      const label = dayLabel(message.createdAt);
      const last = days[days.length - 1];
      if (!last || last.label !== label) days.push({ label, items: [message] });
      else last.items.push(message);
    }
    return days;
  }, [messages]);

  async function postMessage(payload: {
    kind: string;
    content: string;
    fileName?: string | null;
    fileMime?: string | null;
    fileData?: string | null;
  }) {
    setSending(true);
    try {
      const response = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not save", "warn");
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file: File) {
    try {
      if (file.type.startsWith("image/")) {
        const fileData = await compressImage(file);
        await postMessage({
          kind: "image",
          content: file.name,
          fileName: file.name,
          fileMime: "image/jpeg",
          fileData,
        });
        return;
      }
      if (file.size > 1_500_000) {
        onToast("Keep files under 1.5 MB", "warn");
        return;
      }
      const fileData = await readDataUrl(file);
      await postMessage({
        kind: "file",
        content: file.name,
        fileName: file.name,
        fileMime: file.type || "application/octet-stream",
        fileData,
      });
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Upload failed", "warn");
    }
  }

  async function sendText() {
    const content = text.trim();
    if (!content) return;
    setText("");
    const kind = codeMode
      ? "code"
      : /^https?:\/\/\S+$/i.test(content)
        ? "link"
        : "text";
    await postMessage({ kind, content });
    setCodeMode(false);
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void uploadFile(file);
          }
          return;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function remove(id: number) {
    await fetch(`/api/vault/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col reader-glass"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void uploadFile(file);
      }}
    >
      <header className="flex items-center justify-between border-b border-black/8 px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-black/40 uppercase">
            Saved Messages
          </p>
          <h2 className="text-[17px] font-semibold tracking-tight">Cloud Vault</h2>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-black/45">
          <i className="fa-solid fa-cloud" />
          Synced
        </div>
      </header>

      <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-8">
        {grouped.map((group) => (
          <div key={group.label}>
            <p className="mb-3 text-center text-[11px] font-medium text-black/35">{group.label}</p>
            <div className="flex flex-col items-end gap-2">
              {group.items.map((message) => (
                <article key={message.id} className="group max-w-[min(100%,440px)]">
                  {message.kind === "image" && message.fileData ? (
                    <button
                      type="button"
                      className="overflow-hidden rounded-[18px] shadow-md"
                      onClick={() => onPreview(message.fileData || "")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={message.fileData} alt={message.fileName || "Saved image"} className="max-h-72 w-full object-cover" />
                    </button>
                  ) : message.kind === "file" ? (
                    <a
                      href={message.fileData || "#"}
                      download={message.fileName || "file"}
                      className="bubble flex items-center gap-3 px-4 py-3 no-underline"
                    >
                      <i className="fa-solid fa-file-arrow-down text-lg" />
                      <span className="text-left text-[13px] leading-tight">
                        <span className="block font-medium">{message.fileName || "Attachment"}</span>
                        <span className="text-[11px] text-white/70">{message.fileMime}</span>
                      </span>
                    </a>
                  ) : message.kind === "code" ? (
                    <pre className="overflow-x-auto rounded-[16px] bg-[#1d1d1f] px-4 py-3 text-[12px] leading-relaxed text-[#d4d4d8] shadow-lg">
                      <code>{message.content}</code>
                    </pre>
                  ) : message.kind === "link" ? (
                    <a
                      href={message.content}
                      target="_blank"
                      rel="noreferrer"
                      className="bubble block px-4 py-3 text-[14px] underline-offset-2 hover:underline"
                    >
                      <i className="fa-solid fa-link mr-2 text-[12px]" />
                      {message.content}
                    </a>
                  ) : (
                    <div className="bubble px-4 py-2.5 text-[14.5px] leading-relaxed">{message.content}</div>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-3 pr-1 text-[10px] text-black/35">
                    <span>{formatFullDate(message.createdAt).split(",").slice(-1)[0]}</span>
                    <button
                      type="button"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={() => void remove(message.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-black/8 px-4 py-3 sm:px-6">
        <div className="flex items-end gap-2 rounded-[22px] bg-white/80 px-3 py-2 shadow-inner ring-1 ring-black/5">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-black/50 hover:bg-black/5"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach"
          >
            <i className="fa-solid fa-paperclip" />
          </button>
          <button
            type="button"
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              codeMode ? "bg-black text-white" : "text-black/50 hover:bg-black/5"
            }`}
            onClick={() => setCodeMode((value) => !value)}
            aria-label="Code snippet"
          >
            <i className="fa-solid fa-code text-[13px]" />
          </button>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendText();
              }
            }}
            rows={codeMode ? 4 : 1}
            placeholder={codeMode ? "Paste a snippet…" : "Message yourself…"}
            className={`max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none ${
              codeMode ? "font-mono text-[13px]" : ""
            }`}
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={() => void sendText()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#007aff] text-white disabled:opacity-40"
            aria-label="Send"
          >
            <i className="fa-solid fa-arrow-up text-sm" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-black/35">
          Paste screenshots with ⌘V / Ctrl+V · drag files anywhere
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          event.target.value = "";
        }}
      />

      {dragging ? (
        <div className="drop-glow pointer-events-none absolute inset-3 rounded-[18px] bg-[#007aff]/10">
          <div className="flex h-full items-center justify-center text-sm font-medium text-[#007aff]">
            Drop to save in vault
          </div>
        </div>
      ) : null}
    </section>
  );
}
