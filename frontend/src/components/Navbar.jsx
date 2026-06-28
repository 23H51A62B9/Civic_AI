import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

export default function Navbar({ activeTab, setActiveTab, userScore = 0, trustScore = 50, user, userRole = "citizen", onToggleRole }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Simple Gamification Level logic
  const getLevel = (score) => {
    if (score >= 1000) return { name: "City Legend", class: "bg-red-500 text-white animate-pulse" };
    if (score >= 500) return { name: "Local Hero", class: "bg-amber-500 text-white font-bold" };
    if (score >= 200) return { name: "Civic Guardian", class: "bg-purple-600 text-white font-semibold" };
    return { name: "Community Novice", class: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
  };

  const userLevel = getLevel(userScore);

  // Calculate percentage to next level
  const getLevelProgress = (score) => {
    if (score >= 1000) return { pct: 100, next: "Max Level achieved!" };
    if (score >= 500) return { pct: Math.min(100, Math.round(((score - 500) / 500) * 100)), next: "City Legend (1000)" };
    if (score >= 200) return { pct: Math.min(100, Math.round(((score - 200) / 300) * 100)), next: "Local Hero (500)" };
    return { pct: Math.min(100, Math.round((score / 200) * 100)), next: "Civic Guardian (200)" };
  };

  const progress = getLevelProgress(userScore);

  const getTrustScoreConfig = (score) => {
    if (score >= 70) return { bg: "bg-green-500", text: "text-white", label: "High Trust" };
    if (score >= 40) return { bg: "bg-amber-500", text: "text-white", label: "Medium Trust" };
    return { bg: "bg-gray-500", text: "text-white", label: "Low Trust" };
  };

  const trustConfig = getTrustScoreConfig(trustScore);

  return (
    <nav 
      className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-150 dark:border-gray-800 transition-colors"
      style={{ borderBottom: "1px solid rgba(167, 139, 250, 0.15)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-lg">C</span>
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
              CivicAI
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1.5">
              Agentic Loop <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] inline-block pulse-agent-dot" />
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "dashboard"
                  ? "bg-purple-50 text-purple-600 dark:bg-purple-900/25 dark:text-purple-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              🗺️ Map
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "report"
                  ? "bg-purple-50 text-purple-600 dark:bg-purple-900/25 dark:text-purple-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              📸 Report
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "leaderboard"
                  ? "bg-purple-50 text-purple-600 dark:bg-purple-900/25 dark:text-purple-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              🏆 Ranks
            </button>
            {userRole === "authority" && (
              <button
                onClick={() => setActiveTab("gov")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "gov"
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/25 dark:text-indigo-400"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                🏢 Gov Portal
              </button>
            )}
          </div>

          {/* User Details & Sign Out */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {user?.photoURL ? (
                <div className="relative group cursor-help" title={`Civic Trust Score: ${trustScore} (${trustConfig.label})`}>
                  <img
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border border-purple-200 shadow-sm"
                  />
                  <span className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${trustConfig.bg} flex items-center justify-center text-[7px] font-black text-white shadow-sm`}>
                    ✓
                  </span>
                </div>
              ) : (
                <div className="relative group cursor-help" title={`Civic Trust Score: ${trustScore} (${trustConfig.label})`}>
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    {user?.displayName?.charAt(0) || "U"}
                  </div>
                  <span className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${trustConfig.bg} flex items-center justify-center text-[7px] font-black text-white shadow-sm`}>
                    ✓
                  </span>
                </div>
              )}

              <div className="hidden md:flex flex-col items-start text-xs leading-none space-y-1">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-gray-950 dark:text-white">
                    {user?.displayName?.split(" ")[0]}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[7px] font-bold ${userLevel.class}`}>
                    {userLevel.name}
                  </span>
                </div>
                {/* Level Progress Bar (Gamification improvement) */}
                <div className="w-24">
                  <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                  <span className="text-[7px] text-gray-400 font-semibold block text-right mt-0.5">
                    {progress.next}
                  </span>
                </div>
              </div>

              <div className="h-9 px-2.5 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/20 dark:to-amber-900/10 rounded-xl flex items-center justify-center gap-1 border border-yellow-200 dark:border-yellow-900/30 shadow-sm">
                <span className="text-sm">⚡</span>
                <span className="font-extrabold text-[11px] text-amber-700 dark:text-amber-400">{userScore} pts</span>
              </div>
            </div>

            {/* Gov Mode Simulated Toggle Switch */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 shadow-sm">
              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <span>🛡️</span> Gov Mode
              </span>
              <button
                onClick={onToggleRole}
                title="Toggle simulated Authority role for testing"
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  userRole === "authority" ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-650"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    userRole === "authority" ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleSignOut}
              className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 rounded-lg"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
