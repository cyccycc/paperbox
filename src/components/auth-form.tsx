"use client";

import { useState, type FormEvent } from "react";

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: "login" | "register";
  nextPath: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setPending(false);
      setError(payload?.error || "操作失败，请稍后再试。");
      return;
    }
    window.location.href = nextPath;
  }

  return (
    <form className="sheet space-y-4 rounded-2xl p-6" onSubmit={onSubmit}>
      <label className="block text-sm">
        <span className="mb-1.5 block text-ink-soft">邮箱</span>
        <input
          className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-seal"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-ink-soft">密码</span>
        <input
          className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-seal"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={8}
          required
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="w-full rounded-full bg-seal px-4 py-2.5 text-white hover:bg-seal-deep disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "请稍候…" : isRegister ? "注册并进入" : "登录"}
      </button>
    </form>
  );
}
