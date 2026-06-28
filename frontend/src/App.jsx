import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import CivicMap from "./components/CivicMap";
import IssueCard from "./components/IssueCard";
import ReportForm from "./components/ReportForm";
import Leaderboard from "./components/Leaderboard";
import GovPortal from "./components/GovPortal";
import ImpactStats from "./components/ImpactStats";
import SkeletonCard from "./components/SkeletonCard";
import Login from "./pages/Login";
import { useAuth } from "./contexts/AuthContext";
import { submitIssue, subscribeToIssues, runSlaAudit, updateUserScoreInFirestore, getLeaderboardFromFirestore, upvoteIssue, updateUserRoleInFirestore } from "./utils/dbService";
import { db } from "./firebase";
import { onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";

function CountUp({ value }) {
  const [current, setCurrent] = useState("");

  useEffect(() => {
    const strVal = String(value);
    const numericPart = parseFloat(strVal.replace(/[^0-9.]/g, ""));
    const textPart = strVal.replace(/[0-9.]/g, "");

    if (isNaN(numericPart)) {
      setCurrent(value);
      return;
    }

    const isDecimal = strVal.includes(".");
    const duration = 1000; // 1s
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: easeOutQuad
      const easedProgress = progress * (2 - progress);
      const val = easedProgress * numericPart;
      
      if (isDecimal) {
        setCurrent(val.toFixed(1) + textPart);
      } else {
        setCurrent(Math.floor(val) + textPart);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrent(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{current}</span>;
}

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const width = useWindowWidth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [issues, setIssues] = useState([]);
  const [viewMode, setViewMode] = useState("pins");
  const [userScore, setUserScore] = useState(0);
  const [userRole, setUserRole] = useState("citizen");
  const [leaderboard, setLeaderboard] = useState([]);
  const [auditRun, setAuditRun] = useState(false);
  const [healthReport, setHealthReport] = useState("");
  const [showHealthReportBanner, setShowHealthReportBanner] = useState(true);
  const [trustScore, setTrustScore] = useState(50);
  const [loading, setLoading] = useState(true);

  // Sync user score and role in real-time from Firestore (Fix 1)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserScore(data.score || 0);
        setUserRole(data.role || "citizen");
      } else {
        setUserScore(0);
        setUserRole("citizen");
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Handle simulated role toggle
  const handleToggleRole = async () => {
    if (!user) return;
    const nextRole = userRole === "authority" ? "citizen" : "authority";
    try {
      await updateUserRoleInFirestore(user.uid, nextRole);
    } catch (err) {
      console.error("Failed to toggle user role:", err);
    }
  };

  // Redirect to dashboard if user is citizen but tries to access Gov tab
  useEffect(() => {
    if (activeTab === "gov" && userRole !== "authority") {
      setActiveTab("dashboard");
    }
  }, [userRole, activeTab]);

  // Calculate and fetch dynamic city health report from Gemini (Feature 2)
  useEffect(() => {
    const fetchReport = async () => {
      if (issues.length === 0) return;

      const cached = localStorage.getItem("city_health_report");
      const cachedTime = localStorage.getItem("city_health_report_timestamp");
      const now = Date.now();

      if (cached && cachedTime && now - parseInt(cachedTime, 10) < 24 * 60 * 60 * 1000) {
        setHealthReport(cached);
        return;
      }

      const totalCount = issues.length;
      const escalatedCount = issues.filter((i) => i.status === "Escalated").length;
      
      const categories = {};
      issues.forEach((i) => {
        categories[i.category] = (categories[i.category] || 0) + 1;
      });
      const catSummary = Object.entries(categories)
        .map(([cat, count]) => `${cat}: ${count}`)
        .join(", ");

      const resolved = issues.filter((i) => i.status === "Resolved");
      let avgResDays = "3.2 days";
      if (resolved.length > 0) {
        let totalDays = 0;
        resolved.forEach((i) => {
          const created = new Date(i.createdAt);
          const resolvedDate = i.resolvedAt ? new Date(i.resolvedAt) : new Date();
          const diffTime = Math.abs(resolvedDate - created);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDays += diffDays;
        });
        avgResDays = `${(totalDays / resolved.length).toFixed(1)} days`;
      }

      const summaryText = `Total weekly reports: ${totalCount}. Category breakdown: ${catSummary}. Escalated (SLA breached) issues count: ${escalatedCount}. Average resolution time: ${avgResDays}.`;

      try {
        const { generateHealthReport } = await import("./utils/gemini");
        const report = await generateHealthReport(summaryText);
        setHealthReport(report);
        localStorage.setItem("city_health_report", report);
        localStorage.setItem("city_health_report_timestamp", String(now));
      } catch (err) {
        console.error("Failed to generate weekly health report:", err);
      }
    };

    fetchReport();
  }, [issues]);

  // Sync and calculate Citizen Trust Score (Feature 3)
  useEffect(() => {
    if (!user || issues.length === 0) return;

    const myIssues = issues.filter(i => i.uid === user.uid || (i.reportedBy && (i.reportedBy === user.email || i.reportedBy === user.displayName)));
    const submittedCount = myIssues.length;
    const resolvedCount = myIssues.filter(i => i.status === "Resolved").length;
    const upvotesReceived = myIssues.reduce((sum, i) => sum + (i.upvotes || 0), 0);

    const fetchDuplicatesAndCalc = async () => {
      let duplicatesCount = 0;
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          duplicatesCount = userSnap.doc ? userSnap.data().duplicatesCount || 0 : (userSnap.data().duplicatesCount || 0);
        }
      } catch (e) {
        console.warn("Failed to get duplicatesCount from Firestore:", e);
        try {
          const localUserStr = localStorage.getItem(`civicai_user_${user.uid}`);
          const localUser = localUserStr ? JSON.parse(localUserStr) : {};
          duplicatesCount = localUser.duplicatesCount || 0;
        } catch (err) {}
      }

      const calculatedScore = Math.max(0, 50 + (submittedCount * 10) + (resolvedCount * 20) + (upvotesReceived * 15) - (duplicatesCount * 5));
      setTrustScore(calculatedScore);

      try {
        await setDoc(doc(db, "users", user.uid), {
          trustScore: calculatedScore
        }, { merge: true });
      } catch (err) {
        console.warn("Failed to sync trustScore to Firestore:", err);
      }
    };

    fetchDuplicatesAndCalc();
  }, [issues, user]);

  // Real-time Firestore issues sync (Fix 2 & Step 2)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeToIssues((list) => {
      setIssues(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Run SLA Audit exactly once when issues load to avoid async feedback loops
  useEffect(() => {
    if (issues.length > 0 && !auditRun) {
      setAuditRun(true);
      runSlaAudit(issues).catch((err) => console.error("SLA Audit failed:", err));
    }
  }, [issues, auditRun]);

  // Reload leaderboard whenever tab changes to leaderboard or issues change
  useEffect(() => {
    if (!user) return;
    const loadLeaderboard = async () => {
      try {
        const data = await getLeaderboardFromFirestore();
        setLeaderboard(data);
      } catch (err) {
        console.error("Leaderboard load failed:", err);
      }
    };
    loadLeaderboard();
  }, [activeTab, issues, user]);

  const handleAddPoints = async (amount) => {
    if (!user) return;
    try {
      await updateUserScoreInFirestore(user.uid, user.displayName, user.photoURL, amount);
    } catch (err) {
      console.error("Failed to add points:", err);
    }
  };

  const handleIssueCreated = async (newIssueData) => {
    try {
      let res = null;
      if (newIssueData && user) {
        // Store user uid with every report (Fix 1)
        res = await submitIssue({
          ...newIssueData,
          uid: user.uid,
          reportedBy: user.displayName || user.email
        });
      }
      setActiveTab("dashboard"); // switch to map view
      return res;
    } catch (err) {
      console.error(err);
    }
  };

  // Stats Calculations
  const totalReports = issues.length;
  const activeEscalations = issues.filter((i) => i.status === "Escalated").length;
  const resolvedIssuesCount = issues.filter((i) => i.status === "Resolved").length;

  const getDeptResolutionStats = () => {
    const stats = {};
    issues.forEach((issue) => {
      const dept = issue.department || "General Municipal Authority";
      if (!stats[dept]) {
        stats[dept] = { total: 0, resolved: 0 };
      }
      stats[dept].total += 1;
      if (issue.status === "Resolved") {
        stats[dept].resolved += 1;
      }
    });
    return Object.entries(stats).map(([name, data]) => ({
      name,
      total: data.total,
      resolved: data.resolved,
      percentage: Math.round((data.resolved / data.total) * 100) || 0,
    }));
  };

  const deptStats = getDeptResolutionStats();

  const getLatestResolvedIssue = () => {
    const resolved = issues.filter(i => i.status === "Resolved");
    if (resolved.length === 0) return null;
    return resolved[0];
  };

  const getResolutionDays = (issue) => {
    if (!issue || !issue.createdAt) return "3";
    let resDate = null;
    if (issue.resolvedAt) {
      resDate = new Date(issue.resolvedAt);
    } else if (issue.agentLog && issue.agentLog.length > 0) {
      const resLog = issue.agentLog.find(l => l.status.includes("resolved") || l.status.includes("resolution") || l.status.includes("closed"));
      if (resLog && resLog.timestamp) {
        const parts = resLog.timestamp.split("/");
        if (parts.length === 3) {
          resDate = new Date(parts[2], parts[0] - 1, parts[1]);
        }
      }
    }
    const birthParts = issue.createdAt.split("/");
    if (birthParts.length === 3) {
      const birthDate = new Date(birthParts[2], birthParts[0] - 1, birthParts[1]);
      const end = resDate || new Date();
      const diffDays = Math.ceil(Math.abs(end - birthDate) / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return "3";
  };

  const latestResolved = getLatestResolvedIssue();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-purple-500 font-sans">
        <span className="text-4xl animate-spin">⚡</span>
      </div>
    );
  }

  // If no user, show clean premium Google login screen (Fix 1 / Step 1)
  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userScore={userScore} 
        trustScore={trustScore} 
        user={user} 
        userRole={userRole}
        onToggleRole={handleToggleRole}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Weekly AI Health Report Banner (Feature 2) */}
        {activeTab === "dashboard" && showHealthReportBanner && healthReport && (
          <div className="bg-gradient-to-r from-purple-600/90 to-indigo-700/90 backdrop-blur text-white p-5 rounded-3xl mb-6 shadow-md border border-purple-550/30 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none"></div>
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">📊</span>
              <div>
                <span className="bg-white/20 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest block max-w-max mb-1">
                  Weekly AI Report
                </span>
                <p className="text-xs font-bold leading-relaxed">{healthReport}</p>
              </div>
            </div>
            <button
              onClick={() => setShowHealthReportBanner(false)}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-inner shrink-0"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <ImpactStats issues={issues} />

            {/* Map Section Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-6 border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                      Live Community Issue Map
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Click pins on the map to view reports, upvote issues, or view predictive overlays.
                    </p>
                  </div>

                  <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-850 p-1.5 rounded-xl border border-gray-200/50 dark:border-gray-800">
                    <button
                      onClick={() => setViewMode("pins")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "pins"
                          ? "bg-white text-gray-900 dark:bg-gray-800 dark:text-white shadow"
                          : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      📍 Pins
                    </button>
                    <button
                      onClick={() => setViewMode("heatmap")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "heatmap"
                          ? "bg-white text-gray-900 dark:bg-gray-800 dark:text-white shadow"
                          : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      🔥 Heatmap
                    </button>
                    <button
                      onClick={() => setViewMode("predictive")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "predictive"
                          ? "bg-white text-gray-900 dark:bg-gray-800 dark:text-white shadow"
                          : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      🤖 Predictive
                    </button>
                  </div>
                </div>

                <CivicMap
                  issues={issues}
                  isHeatmapMode={viewMode === "heatmap"}
                  isPredictiveMode={viewMode === "predictive"}
                  onUpvote={async (id) => {
                    try {
                      await upvoteIssue(id);
                      await handleAddPoints(10);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                />
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                    Live Impact Dashboard
                  </h3>
                  <p className="text-[11px] text-gray-400 mb-5">
                    Real-time community health and department resolution statistics.
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="p-3.5 bg-gradient-to-r from-green-50/40 to-green-100/10 dark:from-green-950/10 dark:to-transparent border border-green-100/80 dark:border-green-900/30 rounded-2xl flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-sm">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Safe Commutes</span>
                        <span className="text-xs font-black text-green-700 dark:text-green-400">+{resolvedIssuesCount * 15} motorists protected</span>
                      </div>
                      <span className="text-2xl filter drop-shadow">🚗</span>
                    </div>

                    <div className="p-3.5 bg-gradient-to-r from-amber-50/40 to-amber-100/10 dark:from-amber-950/10 dark:to-transparent border border-amber-100/80 dark:border-amber-900/30 rounded-2xl flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-sm">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Illuminated Streets</span>
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400">+{issues.filter(i => i.category.includes("Streetlight") && i.status === "Resolved").length} paths restored</span>
                      </div>
                      <span className="text-2xl filter drop-shadow">💡</span>
                    </div>

                    <div className="p-3.5 bg-gradient-to-r from-blue-50/40 to-blue-100/10 dark:from-blue-950/10 dark:to-transparent border border-blue-100/80 dark:border-blue-900/30 rounded-2xl flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-sm">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Clean Sanitation</span>
                        <span className="text-xs font-black text-blue-700 dark:text-blue-400">+{issues.filter(i => i.category.includes("Garbage") && i.status === "Resolved").length * 150} kg waste cleared</span>
                      </div>
                      <span className="text-2xl filter drop-shadow">🧹</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-left">
                      Department Resolution Rates
                    </h4>
                    {deptStats.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No active departments reported yet.</p>
                    ) : (
                      deptStats.map((dept, index) => (
                        <div key={index} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{dept.name}</span>
                            <span className="text-purple-650 dark:text-purple-400">{dept.resolved}/{dept.total} ({dept.percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden border border-gray-200/20 dark:border-gray-700/20">
                            <div 
                              className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 h-full rounded-full transition-all duration-500 shadow-sm" 
                              style={{ width: `${dept.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Success Story Card */}
                  {latestResolved && (
                    <div className="mt-6 bg-gradient-to-br from-green-50/20 via-white to-transparent dark:from-green-950/10 dark:via-gray-900 dark:to-transparent border border-green-150/60 dark:border-green-900/20 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest block">
                          🌟 Success Story
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500 text-white font-black uppercase tracking-wider">
                          Resolved
                        </span>
                      </div>
                      
                      <div className="flex gap-3">
                        {latestResolved.imageUrl && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-150 dark:border-gray-800 shadow-inner">
                            {latestResolved.isVideo || latestResolved.imageUrl.toLowerCase().includes(".mp4") || latestResolved.imageUrl.toLowerCase().includes(".mov") || latestResolved.imageUrl.toLowerCase().includes(".webm") ? (
                              <video src={latestResolved.imageUrl} className="w-full h-full object-cover" muted playsinline />
                            ) : (
                              <img src={latestResolved.imageUrl} className="w-full h-full object-cover" alt="Before" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border border-gray-200/50 dark:border-gray-700/50">
                            {latestResolved.category.split("/")[0]}
                          </span>
                          <h5 className="font-extrabold text-xs text-gray-950 dark:text-white mt-1.5 truncate">
                            {latestResolved.title}
                          </h5>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                            Resolved in {getResolutionDays(latestResolved)} days by {latestResolved.department || "Municipal Crew"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
                  <div className="p-3.5 bg-gradient-to-br from-purple-50/50 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/10 rounded-2xl text-[10px] text-purple-700 dark:text-purple-450 border border-purple-100/50 dark:border-purple-950/50 leading-relaxed font-bold shadow-sm">
                    💡 <strong>AI Hotspot Prediction:</strong> Deterioration clusters expected near junctions due to monsoon load.
                  </div>
                </div>
              </div>
            </div>

            {/* Issues List */}
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                Active Reports and Agent Tracking
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {issues.length === 0 && loading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : issues.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    No reports logged in this area. Be the first to report!
                  </div>
                ) : (
                  issues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onAddPoints={handleAddPoints}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "report" && (
          <ReportForm
            onIssueCreated={handleIssueCreated}
            onAddPoints={handleAddPoints}
            issues={issues}
          />
        )}

        {activeTab === "leaderboard" && (
          <Leaderboard leaderboard={leaderboard} currentUser={user} currentUserScore={userScore} />
        )}

        {activeTab === "gov" && userRole === "authority" && (
          <GovPortal
            issues={issues}
            onIssueUpdated={() => {
              // The real-time listener will sync automatically
            }}
          />
        )}
      </main>

      <footer className="bg-white dark:bg-gray-900 border-t border-gray-150 dark:border-gray-800 py-6 mt-10 transition-colors pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>© 2026 CivicAI • Empowering Cleaner & Safer Cities.</p>
          <p className="mt-1">Powered by OpenStreetMap & Gemini Vision AI.</p>
        </div>
      </footer>

      {/* Mobile Bottom Nav (Feature 2) */}
      {width < 768 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 flex items-center justify-around h-16 shadow-lg md:hidden">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
              activeTab === "dashboard" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-[10px] mt-0.5">Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
              activeTab === "dashboard" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className="text-xl">📍</span>
            <span className="text-[10px] mt-0.5">Map</span>
          </button>
          
          <button
            onClick={() => setActiveTab("report")}
            className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
              activeTab === "report" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className="text-xl text-blue-500">➕</span>
            <span className="text-[10px] mt-0.5">Report</span>
          </button>

          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
              activeTab === "leaderboard" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className="text-xl">👤</span>
            <span className="text-[10px] mt-0.5">Profile</span>
          </button>
        </div>
      )}
    </div>
  );
}
