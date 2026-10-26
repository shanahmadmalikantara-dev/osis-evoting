import { LoginCard } from "@/components/auth/LoginCard";

export const metadata = { title: "Masuk Admin · Pemilu OSIS" };

export default function AdminLoginPage() {
  return <LoginCard role="admin" />;
}
