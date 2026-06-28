import React from "react";

export default function Leaderboard({ leaderboard = [], currentUser, currentUserScore = 0 }) {
  // Sort the leaderboard
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);
  
  // Calculate ranks
  const rankedList = sortedLeaderboard.map((item, idx) => {
    const isCurrentUser = currentUser && item.uid === currentUser.uid;
    const resolvedCount = Math.floor((item.score || 0) / 100);
    
    const getBadge = (score) => {
      if (score >= 1000) return "City Legend";
      if (score >= 500) return "Local Hero";
      if (score >= 200) return "Civic Guardian";
      return "Community Novice";
    };

    return {
      rank: idx + 1,
      uid: item.uid,
      name: isCurrentUser ? `${item.displayName || "You"} (You)` : (item.displayName || "Anonymous Advocate"),
      score: item.score || 0,
      photoURL: item.photoURL,
      badge: getBadge(item.score || 0),
      issuesResolved: resolvedCount,
      isCurrentUser
    };
  });

  const BADGES = [
    { id: "reporter", name: "Novice Reporter", desc: "Reported your first civic issue", icon: "📢", unlocked: currentUserScore > 0 },
    { id: "sentinel", name: "SLA Sentinel", desc: "Helped track and escalate an issue", icon: "🛡️", unlocked: currentUserScore >= 110 },
    { id: "guardian", name: "Civic Guardian", desc: "Earned 200+ points", icon: "🏅", unlocked: currentUserScore >= 200 },
    { id: "hero", name: "Local Hero", desc: "Earned 500+ points", icon: "👑", unlocked: currentUserScore >= 500 },
  ];

  const unlockedCount = BADGES.filter(b => b.unlocked).length;
  const progressPercent = Math.round((unlockedCount / BADGES.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Inline Styles for Advanced CSS Animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(167, 139, 250, 0.2); }
          50% { box-shadow: 0 0 24px rgba(167, 139, 250, 0.4); }
        }
        @keyframes border-shimmer {
          0% { border-color: rgba(167, 139, 250, 0.3); }
          50% { border-color: rgba(129, 140, 248, 0.8); }
          100% { border-color: rgba(167, 139, 250, 0.3); }
        }
        .float-badge {
          animation: float-slow 4s ease-in-out infinite;
        }
        .shimmer-row {
          animation: border-shimmer 3s ease-in-out infinite;
        }
      `}</style>

      {/* Tech Integration Partners */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-50/40 via-indigo-55/20 to-blue-55/30 dark:from-purple-950/10 dark:via-indigo-950/5 dark:to-blue-950/10 border border-purple-100/50 dark:border-purple-900/10 backdrop-blur-md text-center relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 via-pink-400 to-indigo-500"></div>
        <span className="text-[9px] uppercase font-black tracking-widest text-purple-650 dark:text-purple-400 block mb-2.5">
          Tech Integration Partners
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-bold text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-150 dark:border-gray-800 hover:scale-105 hover:border-blue-400 transition-all duration-300">
            <span className="text-blue-600 font-extrabold">Google</span>
            <span className="text-gray-500 dark:text-gray-450 font-medium">Developers</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-150 dark:border-gray-800 hover:scale-105 hover:border-amber-400 transition-all duration-300">
            <span className="text-amber-500 font-black text-xs">🥷</span>
            <span>Coding Ninjas</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-150 dark:border-gray-800 hover:scale-105 hover:border-purple-400 transition-all duration-300">
            <span className="text-purple-650 font-black">Vibe2Ship</span>
          </div>
        </div>
      </div>

      {/* Main Leaderboard & Badges Card */}
      <div className="bg-gradient-to-br from-white to-purple-50/10 dark:from-gray-900 dark:to-purple-950/10 rounded-3xl border border-purple-100/50 dark:border-purple-900/20 p-6 sm:p-8 shadow-xl backdrop-blur-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 mb-2">
            🏆 Community Standings
          </span>
          <h2 className="text-3xl font-black bg-gradient-to-r from-purple-650 to-indigo-650 bg-clip-text text-transparent tracking-tight">
            Civic Hero Rankings
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-405 mt-1.5 max-w-md mx-auto leading-relaxed">
            Earn points by upvoting reports, submitting municipal complaints, and verifying local fixes. Unlock digital achievement badges as you climb!
          </p>
        </div>

        {/* Digital Achievements Section */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-b from-purple-50/30 to-indigo-50/10 dark:from-purple-950/10 dark:to-indigo-950/5 border border-purple-100/30 dark:border-purple-900/10 shadow-inner">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <h3 className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                Your Badges & Achievements
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-0.5 font-medium">Collect trophies based on community contributions.</p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-extrabold text-purple-655 dark:text-purple-400">
                {unlockedCount} / {BADGES.length} Unlocked
              </span>
              <div className="w-20 bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-300/10">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {BADGES.map((badge, idx) => (
              <div 
                key={badge.id} 
                className={`p-4 rounded-2xl border text-center transition-all duration-300 relative group overflow-hidden collectible-card ${
                  badge.unlocked 
                    ? "bg-white dark:bg-gray-850 border-purple-200 dark:border-purple-900/50 shadow-sm hover:shadow-md" 
                    : "bg-gray-50/30 dark:bg-gray-900/20 border-gray-150 dark:border-gray-800/80 opacity-50 hover:opacity-70"
                }`}
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                {/* Glow filter behind unlocked badges */}
                {badge.unlocked && (
                  <div className="absolute -inset-10 bg-gradient-to-tr from-purple-400/5 to-indigo-400/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}

                <div className="relative z-10 space-y-2">
                  <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform duration-300 group-hover:scale-105 ${
                    badge.unlocked 
                      ? "bg-purple-50/80 dark:bg-purple-900/40 border border-purple-100/30 dark:border-purple-800/10" 
                      : "bg-gray-250/50 dark:bg-gray-800/50"
                  }`}>
                    {badge.unlocked ? badge.icon : "🔒"}
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-black text-gray-800 dark:text-gray-250 truncate">
                      {badge.name}
                    </h4>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-relaxed mt-0.5 line-clamp-2 min-h-[26px] font-medium">
                      {badge.desc}
                    </p>
                  </div>

                  <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    badge.unlocked 
                      ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" 
                      : "bg-gray-100 text-gray-450 dark:bg-gray-800/40 dark:text-gray-600"
                  }`}>
                    {badge.unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1 mb-2">
            <h3 className="text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest">
              Advocate Standings
            </h3>
            <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider bg-gray-50 dark:bg-gray-850 px-2 py-0.5 rounded-md border border-gray-205/30">
              Live updates
            </span>
          </div>

          <div className="space-y-2.5">
            {rankedList.map((user) => {
              // Custom rank card styling
              let rankStyle = "bg-white dark:bg-gray-850 border-gray-150 dark:border-gray-800/60";
              let rankBadgeStyle = "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
              let hoverBorder = "hover:border-purple-300/60 dark:hover:border-purple-800/40";
              let crownEmoji = "";
              
              if (user.rank === 1) {
                rankStyle = "bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-transparent border-amber-300 dark:border-amber-900/40 shadow-sm";
                rankBadgeStyle = "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black";
                hoverBorder = "hover:border-amber-400 dark:hover:border-amber-700";
                crownEmoji = "👑";
              } else if (user.rank === 2) {
                rankStyle = "bg-gradient-to-r from-slate-400/5 via-slate-300/2 to-transparent border-slate-300 dark:border-gray-800 shadow-sm";
                rankBadgeStyle = "bg-gradient-to-r from-slate-350 to-gray-300 text-slate-900 font-black";
                hoverBorder = "hover:border-slate-350 dark:hover:border-slate-650";
                crownEmoji = "🥈";
              } else if (user.rank === 3) {
                rankStyle = "bg-gradient-to-r from-amber-700/5 via-amber-600/2 to-transparent border-amber-600/40 dark:border-amber-900/20 shadow-sm";
                rankBadgeStyle = "bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black";
                hoverBorder = "hover:border-amber-600 dark:hover:border-amber-800";
                crownEmoji = "🥉";
              }

              if (user.isCurrentUser) {
                rankStyle = "bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-400 dark:border-purple-750 shadow-md ring-1 ring-purple-400/20 shimmer-row";
              }

              return (
                <div
                  key={user.uid || user.rank}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-350 hover:scale-[1.008] hover:-translate-y-0.5 shadow-inner ${rankStyle} ${hoverBorder}`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Rank Circle */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-inner ${rankBadgeStyle}`}>
                      {user.rank}
                    </div>

                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        referrerPolicy="no-referrer"
                        alt={user.name}
                        className="w-10 h-10 rounded-full border border-purple-100 dark:border-gray-700 shadow-sm object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-650 text-white flex items-center justify-center font-extrabold text-sm shadow-md">
                        {user.name.charAt(0)}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${
                          user.isCurrentUser 
                            ? "text-purple-705 dark:text-purple-400" 
                            : "text-gray-800 dark:text-gray-100"
                        }`}>
                          {user.name} {crownEmoji}
                        </span>
                        {user.isCurrentUser && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-650 text-white font-extrabold text-[8px] uppercase tracking-wider animate-pulse">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-0.5 items-center flex-wrap">
                        <span className="text-[8px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest border border-gray-200/50 dark:border-gray-750">
                          {user.badge}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          • {user.issuesResolved} fixes verified
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent flex items-center gap-1 justify-end">
                      <span>⚡</span> {user.score} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
