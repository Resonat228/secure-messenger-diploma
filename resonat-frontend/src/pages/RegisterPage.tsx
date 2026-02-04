// src/pages/RegisterPage.tsx
import RegisterForm from "../components/Auth/RegisterForm";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const navigate = useNavigate();

  return (
    <RegisterForm
      onRegistered={() => {
        navigate("/login");
      }}
    />
  );
}
