"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (loading || auth.currentUser) return; // prevent double trigger
    setLoading(true);

    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);

      const token = await result.user.getIdToken();

      await fetch("http://localhost:4000/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Logged in:", result.user.email);
    } catch (err: any) {
      console.error("Login failed:", err.code, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 shadow-2xl w-[420px]">
        <h1 className="text-3xl font-semibold text-white mb-3">
          BeatSync Studio 🎵
        </h1>

        <p className="text-gray-300 mb-6">
          Ultra-precise synced music playback across devices.
        </p>

        <button
          type="button"
          onClick={login}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        <p className="text-gray-400 text-sm mt-4 text-center">
          Sign in to continue
        </p>
      </div>
    </div>
  );
}
