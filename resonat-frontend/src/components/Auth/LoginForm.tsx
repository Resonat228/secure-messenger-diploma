// src/components/Auth/LoginForm.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== password2) {
      setError("Пароли не совпадают");
      return;
    }

    try {
      setLoading(true);

      if (mode === "login") {
        const data = await login(email, password, totp || undefined);
        setAuth({ user: data.user, token: data.access_token });
        navigate("/chat");
      } else {
        const data = await register(email, password);
        setAuth({ user: data.user, token: data.access_token });
        navigate("/chat");
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.message ??
        "Что-то пошло не так. Попробуй ещё раз.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
  };

  return (
    <div className="auth-card">
      <h1 className="auth-title">
        {mode === "login" ? "Вход в защищённый мессенджер" : "Регистрация в Resonat"}
      </h1>
      <p className="auth-subtitle">
        {mode === "login"
          ? "Введи почту и пароль, чтобы войти."
          : "Создаём новый аккаунт, дальше добавим 2FA и E2EE."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label">
          Email
          <input
            type="email"
            className="auth-input"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="auth-label">
          Пароль
          <input
            type="password"
            className="auth-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {mode === "register" && (
          <label className="auth-label">
            Повтор пароля
            <input
              type="password"
              className="auth-input"
              placeholder="ещё раз пароль"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </label>
        )}

        {mode === "login" && (
          <label className="auth-label">
            TOTP (если включён)
            <input
              type="text"
              className="auth-input"
              placeholder="123456"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
            />
          </label>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          className="auth-button primary"
          disabled={loading}
        >
          {loading
            ? "Подождём…"
            : mode === "login"
            ? "Войти"
            : "Зарегистрироваться"}
        </button>
      </form>

      <button
        type="button"
        className="auth-button secondary"
        onClick={switchMode}
        disabled={loading}
      >
        {mode === "login"
          ? "Нет аккаунта? Зарегистрироваться"
          : "Уже есть аккаунт? Войти"}
      </button>
    </div>
  );
}
