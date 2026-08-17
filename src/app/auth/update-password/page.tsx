"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      // Check device trust
      const res = await fetch("/api/auth/device-check", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Device check failed");

      if (data.status === "requires_pin") {
        router.push("/auth/verify-device?callbackUrl=/studio");
      } else {
        router.push("/studio");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update password. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2a2a] via-[#0B0B0B] to-[#0B0B0B] opacity-50 pointer-events-none" />
      
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md w-full max-w-md mx-auto p-8 bg-[#0B0B0B] border border-[#222222] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-[#F6F1E7]">
        <div className="text-center mb-8 flex flex-col items-center">
          <KeyRound className="w-12 h-12 text-[#A8A399] mb-4" />
          <h2 className="font-serif text-3xl font-bold mb-2">Set New Password</h2>
          <p className="text-[#A8A399] text-sm">
            Please enter your new password below.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 border border-[#B3261E]/50 bg-[#B3261E]/10 text-[#B3261E] text-xs font-mono uppercase tracking-wide text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-mono tracking-widest text-[#A8A399] uppercase">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#111111] border border-[#333333] text-[#F6F1E7] px-4 py-3 focus:outline-none focus:border-[#F6F1E7] transition-colors"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading || password.length < 6}
            className="w-full bg-[#B3261E] text-white px-8 py-4 text-xs tracking-widest font-mono uppercase hover:bg-[#8e1f18] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
