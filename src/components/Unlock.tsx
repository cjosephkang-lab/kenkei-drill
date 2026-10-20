import { useState } from "react";
import { Shell } from "./Shell";

export function Unlock({ error, onUnlock, dark }: { error: string; onUnlock: (password: string) => Promise<void>; dark: boolean }) {
  const [password, setPassword] = useState("");
  return <Shell><section className="mx-auto max-w-md px-5 py-16"><p className="mb-3 text-sm font-semibold tracking-[.2em] text-emerald-700 dark:text-emerald-300">KENKEI / 01</p><h1 className="mb-4 text-4xl font-black leading-tight">建設業経理士1級<br />個人ドリル</h1><p className="mb-8 text-sm opacity-70">暗号化された過去問データを開くには、パスワードを入力してください。</p><input className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-4 outline-none ring-emerald-500 focus:ring-2 dark:bg-white/10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="パスワード" onKeyDown={(event) => event.key === "Enter" && onUnlock(password)} /><button className="w-full rounded-2xl bg-emerald-800 px-4 py-4 font-bold text-white shadow-lg shadow-emerald-900/20" onClick={() => onUnlock(password)}>ドリルを開く</button>{error && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{error}</p>}<span className="sr-only">{String(dark)}</span></section></Shell>;
}
