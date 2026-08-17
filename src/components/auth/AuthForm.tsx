"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowRight, Mail, Phone, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthForm() {
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/studio";
  
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: contact,
          password,
        });
        if (signUpError) throw signUpError;
        
        if (!data.session) {
          throw new Error("Please check your email for a confirmation link. If you already had an account, click 'Forgot Password' to set one.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: contact,
          password,
        });
        if (signInError) throw signInError;
      }

      // Check device trust
      const res = await fetch("/api/auth/device-check", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Device check failed");

      if (data.status === "requires_pin") {
        router.push(`/auth/verify-device?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      } else {
        router.push(callbackUrl);
      }

    } catch (err: any) {
      setError(err.message || "Failed to log in. Please try again.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!contact) {
      setError("Please enter your email to reset password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(contact, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setError("Password reset email sent. Please check your inbox."); // Not an error, just using the state to show a message
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-[#0B0B0B] border border-[#222222] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-[#F6F1E7]">
      <div className="text-center mb-8">
        <h2 className="font-serif text-3xl font-bold mb-2">Creator Studio</h2>
        <p className="text-[#A8A399] text-sm">
          Enter your details to access your dashboard.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 border border-[#B3261E]/50 bg-[#B3261E]/10 text-[#B3261E] text-xs font-mono uppercase tracking-wide text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono tracking-widest text-[#A8A399] uppercase">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-[#666666]" />
              </div>
              <input
                type="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="creator@example.com"
                className="w-full bg-[#111111] border border-[#333333] text-[#F6F1E7] px-4 py-3 pl-10 focus:outline-none focus:border-[#F6F1E7] transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono tracking-widest text-[#A8A399] uppercase">
                Password
              </label>
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-mono text-[#666666] hover:text-[#A8A399] transition-colors"
              >
                Forgot?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#111111] border border-[#333333] text-[#F6F1E7] px-4 py-3 focus:outline-none focus:border-[#F6F1E7] transition-colors"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !contact || !password}
          className="w-full bg-[#B3261E] text-white px-8 py-4 text-xs tracking-widest font-mono uppercase hover:bg-[#8e1f18] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? "Create Account" : "Sign In")}
        </button>

        <div className="pt-4 border-t border-[#222222] text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs font-mono tracking-widest text-[#666666] hover:text-[#A8A399] uppercase transition-colors"
          >
            {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
          </button>
        </div>
      </form>
    </div>
  );
}
