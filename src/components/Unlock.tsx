import { useState } from "react";
import { Shell } from "./Shell";

export function Unlock({
  error,
  onUnlock,
}: {
  error: string;
  onUnlock: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  return (
    <Shell>
      <div className="wrap">
        <section className="home-pad">
          <p className="sub">建設業経理士1級・個人用</p>
          <h1>建設業経理士ドリル</h1>
          <p className="note">
            暗号化された過去問データを開くには、パスワードを入力してください。
          </p>
          <input
            className="setting"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="パスワード"
            onKeyDown={(event) => event.key === "Enter" && onUnlock(password)}
          />
          <button className="start-btn" onClick={() => onUnlock(password)}>
            ドリルを開く
          </button>
          {error && <p className="note">{error}</p>}
        </section>
      </div>
    </Shell>
  );
}
