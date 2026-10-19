"use client";

import { useState, type FormEvent } from "react";

export function AdminCreditForm({ userId, credits }: { userId: string; credits: number }) {
  const [value, setValue] = useState(String(credits));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    const next = Number(trimmed);
    if (!trimmed || !Number.isInteger(next)) {
      setError("请输入整数额度。");
      return;
    }
    setError("");
    setPending(true);
    const response = await fetch("/api/admin/users/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, credits: next }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401) {
      window.location.href = "/login?next=/admin";
      return;
    }
    if (!response.ok) {
      setPending(false);
      setError(payload?.error || "调整失败，请稍后再试。");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <form className="flex items-center gap-2" onSubmit={onSubmit}>
        <input
          className="w-24 rounded-xl border border-line bg-white px-2 py-1.5 outline-none focus:border-seal"
          aria-label="剩余额度"
          inputMode="numeric"
          min={0}
          max={100000}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-seal hover:text-seal disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </form>
      {error ? <p className="text-xs text-warn">{error}</p> : null}
    </div>
  );
}
