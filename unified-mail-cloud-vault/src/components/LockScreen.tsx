"use client";

import { useEffect, useMemo, useState } from "react";
import { formatClock, formatLockDate } from "@/lib/format";

const CORRECT_PIN = "5109";
const KEYS: { digit: string; letters: string }[] = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
];

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Backspace") {
        event.preventDefault();
        setPin((value) => value.slice(0, -1));
        return;
      }
      if (event.key === "Escape") {
        setPin("");
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        setPin((value) => (value.length < 4 ? value + event.key : value));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (pin === CORRECT_PIN) {
      onUnlock();
      return;
    }
    setShake(true);
    setWrong(true);
    const timer = window.setTimeout(() => {
      setPin("");
      setShake(false);
      setWrong(false);
    }, 480);
    return () => window.clearTimeout(timer);
  }, [pin, onUnlock]);

  const time = useMemo(() => formatClock(now), [now]);
  const date = useMemo(() => formatLockDate(now), [now]);

  function press(digit: string) {
    setPin((value) => (value.length < 4 ? value + digit : value));
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center overflow-hidden text-white">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/wallpaper.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/55" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center px-6 pb-10 pt-[max(3.5rem,env(safe-area-inset-top))]">
        <i className="fa-solid fa-lock mb-5 text-sm text-white/80" />
        <div className="text-center">
          <p className="text-[18px] font-medium tracking-wide text-white/92 drop-shadow">{date}</p>
          <h1 className="mt-1 text-[92px] font-thin leading-none tracking-tight text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:text-[108px]">
            {time}
          </h1>
        </div>

        <div className="mt-auto flex w-full flex-col items-center">
          <p className="mb-4 text-[13px] font-medium tracking-[0.18em] text-white/80 uppercase">
            {wrong ? "Try again" : "Enter passcode"}
          </p>
          <div className={`mb-8 flex items-center gap-5 ${shake ? "shake-x" : ""}`}>
            {[0, 1, 2, 3].map((index) => {
              const filled = index < pin.length;
              return (
                <span
                  key={index}
                  className={`h-[13px] w-[13px] rounded-full border border-white/90 ${
                    filled ? "pin-fill bg-white" : "bg-transparent"
                  } ${wrong ? "border-red-300 bg-red-400/80" : ""}`}
                />
              );
            })}
          </div>

          <div className="grid w-[280px] grid-cols-3 gap-x-5 gap-y-4 sm:w-[300px]">
            {KEYS.map((key) => (
              <button
                key={key.digit}
                type="button"
                className="glass-key mx-auto flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full text-white transition sm:h-[78px] sm:w-[78px]"
                onClick={() => press(key.digit)}
              >
                <span className="text-[28px] font-light leading-none">{key.digit}</span>
                <span className="mt-1 text-[9px] font-semibold tracking-[0.22em] text-white/80">
                  {key.letters || "\u00a0"}
                </span>
              </button>
            ))}
            <span />
            <button
              type="button"
              className="glass-key mx-auto flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full text-white transition sm:h-[78px] sm:w-[78px]"
              onClick={() => press("0")}
            >
              <span className="text-[28px] font-light leading-none">0</span>
            </button>
            <button
              type="button"
              className="mx-auto flex h-[74px] w-[74px] items-center justify-center rounded-full text-white/90 sm:h-[78px] sm:w-[78px]"
              onClick={() => setPin((value) => value.slice(0, -1))}
              aria-label="Delete"
            >
              <i className="fa-solid fa-delete-left text-lg" />
            </button>
          </div>
          <p className="mt-8 text-[11px] tracking-wide text-white/55">Touch ID / keyboard enabled</p>
        </div>
      </div>
    </div>
  );
}
