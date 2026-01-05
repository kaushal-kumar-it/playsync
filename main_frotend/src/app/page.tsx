"use client";
import { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser?.email);
      setUser(currentUser);
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Separate effect to handle redirect
  useEffect(() => {
    if (user && !checkingAuth) {
      console.log("Redirecting to dashboard with router.push");
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, checkingAuth, router]);

  const login = async () => {
    console.log("Login button clicked!");
    if (loading || user) {
      console.log("Already loading or user logged in");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    const provider = new GoogleAuthProvider();
    console.log("Starting Google sign in...");

    try {
      console.log("Opening popup...");
      const result = await signInWithPopup(auth, provider);
      console.log("Popup successful, user:", result.user.email);
      
      // Optional: sync with backend (skip if backend is down)
      try {
        const token = await result.user.getIdToken();
        console.log("Got token, sending to backend...");
        
        await axios.get("http://localhost:4000/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        console.log("Backend sync successful");
      } catch (backendError) {
        console.log("Backend sync skipped:", backendError);
      }

      console.log("Logged in:", result.user.email);
      
      // Navigate using Next.js router
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login failed:", err.code, err.message, err);
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setSuccess("");
      setError("");
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError("Logout failed");
    }
  };

  if (checkingAuth || user) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-black via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">
          {checkingAuth ? "Loading..." : "Redirecting to dashboard..."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-20">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              Beatsync
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Ultra-precise synced music playback across devices.
            </p>
          </div>
          <div className="w-full pt-4">
            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Continue with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>{loading ? "Signing in..." : "Continue with Google"}</span>
            </button>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            Sign in to continue
          </p>
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg w-full">
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-400 text-sm bg-green-900/20 p-3 rounded-lg w-full">
              {success}
            </p>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 left-6 z-10">
        <div className="w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center shadow-lg">
          <span className="text-amber-500 font-bold text-lg">B</span>
        </div>
      </div>
    </div>
  );
}