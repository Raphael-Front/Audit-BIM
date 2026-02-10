import { Navigate, useLocation } from "react-router-dom";
import { getTokenFromCookie } from "@/lib/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = getTokenFromCookie();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
