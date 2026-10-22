"use client";

import { useCallback, useEffect, useState } from "react";
import { LockScreen } from "./LockScreen";
import { MailApp } from "./MailApp";

const UNLOCK_KEY = "mail-vault-unlocked";

export function MailShell() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === "1");
    setReady(true);
  }, []);

  const unlock = useCallback(() => {
    sessionStorage.setItem(UNLOCK_KEY, "1");
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
  }, []);

  if (!ready) {
    return <div className="min-h-[100dvh] bg-black" />;
  }

  if (!unlocked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return <MailApp onLock={lock} />;
}
