// src/components/Auth/RegisterForm.tsx
import { useState } from "react";
import type React from "react";
import { register } from "../../api/auth";

interface RegisterFormProps {
  onRegistered?: () => void;
}

export default function RegisterForm({ onRegistered }: RegisterFormProps) {
  const [email, setEmail] = useState("user2@example.com");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== password2) {
      setError("Пароли не совпадают");
      setLoading(false);
      return;
    }

    try {
      await register(email, password);
      onRegistered?.();
    } catch (err: any) {
      const data = err?.response?.data;
      const msg =
        typeof data?.detail === "string"
          ? data.detail
          : Array.isArray(data?.detail)
            ? data.detail.map((x: any) => x?.msg).filter(Boolean).join(", ")
            : "Ошибка регистрации";
      setError(msg);
    } finally {
      setLoading(false);  
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-slate-300">Email</label>
        <input
          type="email"
          className="w-full rounded-xl bg-slate-900/60 border border-slate-600 px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Пароль</label>
        <input
          type="password"
          className="w-full rounded-xl bg-slate-900/60 border border-slate-600 px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Повтор пароля</label>
        <input
          type="password"
          className="w-full rounded-xl bg-slate-900/60 border border-slate-600 px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? "Регистрируем..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
