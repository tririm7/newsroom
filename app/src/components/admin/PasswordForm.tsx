"use client";

import { useState } from "react";

export function PasswordForm() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (newPw.length < 12) {
      setMsg({ kind: "err", text: "New password must be at least 12 characters." });
      return;
    }
    if (newPw !== newPw2) {
      setMsg({ kind: "err", text: "New password and confirmation don't match." });
      return;
    }
    const r = await fetch("/api/admin/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
    });
    if (!r.ok) {
      setMsg({ kind: "err", text: await r.text() });
      return;
    }
    setMsg({ kind: "ok", text: "Password updated." });
    setOldPw(""); setNewPw(""); setNewPw2("");
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white max-w-md">
      <div className="grid gap-3">
        <label className="block text-sm">
          <span className="block font-medium mb-1">Current password</span>
          <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
            autoComplete="current-password"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">New password (min 12 chars)</span>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Confirm new password</span>
          <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </label>
        {msg && (
          <div className={"text-sm px-3 py-2 rounded " + (msg.kind === "ok"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>
        )}
        <button onClick={submit} className="bg-black text-white rounded px-3 py-2 text-sm font-semibold mt-2">
          Update password
        </button>
      </div>
    </div>
  );
}
