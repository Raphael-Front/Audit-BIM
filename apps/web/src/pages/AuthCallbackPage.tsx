import { Navigate } from "react-router-dom";
import { getTokenFromCookie } from "@/lib/api";

export function AuthCallbackPage() {
  const token = getTokenFromCookie();
  return token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}
