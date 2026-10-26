import { LoginCard } from "@/components/auth/LoginCard";

export const metadata = { title: "Masuk Admin · Pemilu MPK" };

export default function AdminLoginPage() {
  return <LoginCard role="admin" />;
}
