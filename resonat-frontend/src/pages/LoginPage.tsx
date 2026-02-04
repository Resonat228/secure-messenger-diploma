// src/pages/LoginPage.tsx
import LoginForm from "../components/Auth/LoginForm";
import "../App.css";

export default function LoginPage() {
  return (
    <div className="auth-layout">
      <div className="auth-logo">Resonat</div>

      <LoginForm />

      <div className="auth-footer">
        
      </div>
    </div>
  );
}
