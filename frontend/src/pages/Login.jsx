import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { loginWithGoogle, loginAsDemo, signUpWithEmail, signInWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Google Sign in failed:", err);
      setError("Sign-in failed. Please make sure Google Sign-in is enabled in your Firebase Console.");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (isSignUp && !displayName) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      console.error("Auth failed:", err);
      // Give readable error message
      let message = err.message || "Authentication failed. Please check your credentials.";
      if (err.code === "auth/weak-password") {
        message = "Password should be at least 6 characters.";
      } else if (err.code === "auth/email-already-in-use") {
        message = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        message = "Invalid email or password. Please try again.";
      } else if (err.code === "auth/configuration-not-found") {
        message = "⚠️ Email/Password sign-in is not enabled. Go to Firebase Console > Authentication > Sign-in method, click 'Add new provider', and enable 'Email/Password'.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdfbf7] via-[#fbf8f0] to-[#faf0e6] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Soft warm floating glows - No dark black/blue */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-purple-300/20 rounded-full filter blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-pink-300/25 rounded-full filter blur-[100px] animate-pulse" />

      {/* Main glass card */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-purple-100/70 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center relative z-10 transition-all duration-300 hover:shadow-2xl">
        
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-900/10 mb-4 hover:scale-105 transition-transform duration-300">
          <span className="text-white font-black text-2xl">C</span>
        </div>

        <h1 className="text-2xl font-black bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent tracking-tight">
          CivicAI
        </h1>
        <p className="text-[9px] uppercase font-black tracking-widest text-purple-650 mt-1 mb-2">
          Hyperlocal Problem Solver
        </p>

        <p className="text-purple-900/60 text-xs mb-6 text-center leading-relaxed">
          Report municipal issues, track autonomous AI resolutions, verify fixes, and earn reputation points to protect your community.
        </p>

        {error && (
          <div className="w-full p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-semibold mb-4 text-center leading-relaxed">
            {error}
          </div>
        )}

        {/* Email Auth Form */}
        <form onSubmit={handleEmailAuth} className="w-full space-y-3.5 mb-5 text-left">
          {isSignUp && (
            <div>
              <label className="block text-[10px] font-black text-purple-900/50 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ color: "#231238" }}
                className="w-full bg-white/80 border border-purple-100 rounded-xl px-3.5 py-2.5 text-xs text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder-purple-300 transition-all duration-200"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-purple-900/50 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ color: "#231238" }}
              className="w-full bg-white/80 border border-purple-100 rounded-xl px-3.5 py-2.5 text-xs text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder-purple-300 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-purple-900/50 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ color: "#231238" }}
              className="w-full bg-white/80 border border-purple-100 rounded-xl px-3.5 py-2.5 text-xs text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder-purple-300 transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-extrabold rounded-xl shadow-md transition-all duration-200 transform hover:-translate-y-0.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97]"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isSignUp ? (
              "Create Account & Sign In"
            ) : (
              "Sign In with Email"
            )}
          </button>
        </form>

        <div className="w-full flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-purple-100"></div>
          <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-purple-100"></div>
        </div>

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full py-3 bg-white hover:bg-purple-50/40 text-purple-950 font-extrabold rounded-xl border border-purple-100 shadow-sm transition-all duration-200 transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 text-xs cursor-pointer active:scale-[0.97]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.187 4.114-3.488 0-6.315-2.827-6.315-6.314s2.827-6.315 6.315-6.315c1.558 0 2.978.563 4.088 1.49l3.053-3.054C18.91 1.957 15.82 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.898 0 10.871-4.248 10.871-11.24 0-.768-.073-1.464-.171-1.955H12.24z"
            />
          </svg>
          Sign In with Google
        </button>

        {/* Demo Sandbox Bypass Button */}
        <button
          onClick={loginAsDemo}
          className="w-full mt-2.5 py-2.5 bg-purple-50/50 hover:bg-purple-100/50 text-purple-700 font-bold rounded-xl border border-purple-100/60 hover:border-purple-200/50 transition-all duration-200 transform hover:-translate-y-0.5 text-[10px] cursor-pointer active:scale-[0.97]"
        >
          🔑 Bypass Sign-In (Demo Sandbox Mode)
        </button>

        {/* Toggle between Sign In / Sign Up */}
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="mt-6 text-[10px] font-black text-purple-600 hover:text-purple-700 transition-colors uppercase tracking-widest cursor-pointer"
        >
          {isSignUp ? "Already have an account? Sign In" : "Need a new account? Register here"}
        </button>

        <div className="mt-6 text-[8px] text-purple-300 font-bold uppercase tracking-widest">
          Powered by Gemini Vision & Firebase
        </div>
      </div>
    </div>
  );
}
