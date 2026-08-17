"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyMasterPassword } from "./actions";
import { ShieldAlert, ArrowRight } from "lucide-react";

export default function AdminVerifyPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await verifyMasterPassword(password);
    if (res.success) {
      router.push("/admin");
    } else {
      setError(res.error || "Verification failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EFE6] flex items-center justify-center p-4 font-body text-[#111111]">
      <div className="max-w-md w-full bg-[#FCFAF6] border border-[#E5E0D8] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center border-b border-[#E5E0D8] bg-white">
          <div className="w-16 h-16 bg-[#FFF5F5] text-[#B3261E] rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="font-display-md text-2xl tracking-wide mb-2">Restricted Area</h1>
          <p className="text-sm text-[#A09D96]">
            This area requires a master password to proceed.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-[#FFF5F5] border border-[#FEE2E2] rounded-lg text-sm text-[#B3261E] text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-2">
              Master Password
            </label>
            <input 
              type="password" 
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#E5E0D8] p-3 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B3261E] transition-all"
              placeholder="Enter master password"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !password}
            className="w-full flex items-center justify-center gap-2 bg-[#111111] text-white py-3 rounded-lg font-label-caps uppercase text-sm hover:bg-black/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Verifying..." : "Verify Access"}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
