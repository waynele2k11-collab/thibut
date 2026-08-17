import { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Login | Creator Studio | Thi Bút",
  description: "Login to your Creator Studio dashboard.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Background Texture/Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2a2a] via-[#0B0B0B] to-[#0B0B0B] opacity-50 pointer-events-none" />
      
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <AuthForm />
      </div>
    </div>
  );
}
