import React, { useState, useEffect } from "react";
import { resolveIssue, upvoteIssue } from "../utils/dbService";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";

export default function IssueCard({ issue, onAddPoints }) {
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [liveIssue, setLiveIssue] = useState(issue);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [statusChanged, setStatusChanged] = useState(false);

  useEffect(() => {
    setLiveIssue(issue);
    if (issue.id && !issue.id.startsWith("local-")) {
      const docRef = doc(db, "issues", issue.id);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setLiveIssue({ id: docSnap.id, ...docSnap.data() });
        }
      });
      return () => unsubscribe();
    }
  }, [issue]);

  useEffect(() => {
    if (!liveIssue.status) return;
    setStatusChanged(true);
    const timer = setTimeout(() => {
      setStatusChanged(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [liveIssue.status]);

  const handleUpvote = async () => {
    if (isUpvoting) return;
    setIsUpvoting(true);
    try {
      await upvoteIssue(liveIssue.id);
      onAddPoints(10); // Reward 10 points for verifying/upvoting
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpvoting(false);
    }
  };

  const handleResolve = async () => {
    if (isResolving) return;
    setIsResolving(true);
    try {
      await resolveIssue(liveIssue.id);
      onAddPoints(50); // Reward 50 points for confirming a resolution
      alert("Thank you for verifying the fix! You earned +50 points! 🎉");
    } catch (err) {
      console.error(err);
    } finally {
      setIsResolving(false);
    }
  };

  const severityBadgeColor = (severity) => {
    if (severity >= 4) return "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900/30";
    if (severity >= 3) return "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30";
    return "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-900/30";
  };

  const getSeverityNumberColor = (sev) => {
    if (sev === 5) return "#f87171";
    if (sev === 4) return "#fb923c";
    if (sev === 3) return "#fbbf24";
    return "#34d399"; // 1-2
  };

  const cardLeftBorder = (status) => {
    if (status === "Resolved") return { borderLeft: "3px solid #10b981" };
    if (status === "Escalated") return { borderLeft: "3px solid #a78bfa" };
    return { borderLeft: "3px solid #f59e0b" }; // pending
  };

  const getStep4DotStyle = (status) => {
    if (status === "Resolved") {
      return { backgroundColor: "#10b981", boxShadow: "0 0 6px #34d399" };
    }
    if (status === "Escalated") {
      return { backgroundColor: "#a78bfa", boxShadow: "0 0 6px #a78bfa" };
    }
    return { backgroundColor: "#f59e0b", boxShadow: "0 0 6px #fbbf24" }; // pending/assigned
  };

  const statusBadgeColor = (status) => {
    switch (status) {
      case "Resolved":
        return "bg-green-500 text-white";
      case "Escalated":
        return "bg-red-600 text-white animate-pulse";
      case "Assigned":
        return "bg-indigo-600 text-white";
      case "Verified":
        return "bg-amber-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div 
      className="premium-card rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md border border-gray-150 dark:border-gray-850"
      style={{
        ...cardLeftBorder(liveIssue.status)
      }}
    >
      {/* Issue Photo/Video */}
      <div className="w-full md:w-56 h-48 md:h-auto relative overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-950">
        {liveIssue.imageUrl && (liveIssue.isVideo || liveIssue.imageUrl.toLowerCase().includes(".mp4") || liveIssue.imageUrl.toLowerCase().includes(".mov") || liveIssue.imageUrl.toLowerCase().includes(".webm")) ? (
          <video
            src={liveIssue.imageUrl}
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={liveIssue.imageUrl || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80"}
            alt={liveIssue.title}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        )}
        <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md ${statusBadgeColor(liveIssue.status)} ${statusChanged ? "status-change" : ""}`}>
          {liveIssue.status}
        </span>
      </div>

      {/* Issue Content */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-purple-650 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-2.5 py-1 rounded-lg border border-purple-100/50 dark:border-purple-900/10">
              {liveIssue.category}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider ${severityBadgeColor(liveIssue.severity)}`}>
                Severity: <span style={{ color: getSeverityNumberColor(liveIssue.severity), fontWeight: "900" }}>{liveIssue.severity}</span>/5
              </span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-850 px-2 py-1 rounded-lg border border-gray-150 dark:border-gray-800">
                📅 {liveIssue.createdAt}
              </span>
            </div>
          </div>

          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2 leading-tight">
            {liveIssue.title}
          </h3>

          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed font-medium">
            {liveIssue.description}
          </p>

          {/* Department and Location Info */}
          <div className="flex flex-col gap-2 text-xs text-gray-505 dark:text-gray-400 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-850 dark:to-gray-900/30 px-4 py-3.5 rounded-2xl border border-gray-150 dark:border-gray-800/80 mb-4 shadow-inner">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Target Department:</span>
              <span className="font-bold text-gray-800 dark:text-gray-250">{liveIssue.department}</span>
            </div>
            {liveIssue.locationName && (
              <div className="flex items-start gap-1.5 flex-wrap border-t border-gray-200 dark:border-gray-750 pt-2 mt-1">
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">📍 Address:</span>
                <span className="text-indigo-650 dark:text-indigo-400 font-extrabold leading-snug">{liveIssue.locationName}</span>
              </div>
            )}
          </div>

          {/* Overdue Warning Banner */}
          {liveIssue.status === "Escalated" && (
            <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-550 text-red-800 dark:text-red-400 p-4 rounded-xl text-xs mb-4 shadow-sm">
              <p className="font-black mb-1 flex items-center gap-1">
                <span>🚨</span> AI Agent Intervention: SLA Overdue
              </p>
              <p className="leading-relaxed">This ticket has been ignored for 7+ days. The AI Agent has generated and automatically dispatched a formal escalation complaint to the Chief Municipal Officer.</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-2 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleUpvote}
              disabled={isUpvoting || liveIssue.status === "Resolved"}
              className={`px-4.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm border transition-all active:scale-[0.97] ${
                liveIssue.status === "Resolved"
                  ? "bg-gray-50 dark:bg-gray-850 text-gray-400 border-gray-150 dark:border-gray-800 cursor-not-allowed"
                  : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 cursor-pointer shadow-sm"
              }`}
            >
              👍 Upvote ({liveIssue.upvotes || 0})
            </button>

            {liveIssue.status !== "Resolved" && (
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="px-4.5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 active:scale-[0.97] transition-all cursor-pointer hover:shadow-lg"
              >
                ✅ Verify Fixed (+50 pts)
              </button>
            )}
          </div>
        </div>

        {/* AGENT 2 - Expandable AI Agent Log Timeline */}
        <div className="mt-6 border-t border-gray-150 dark:border-gray-800 pt-5 space-y-4">
          <button
            onClick={() => setIsLogExpanded(!isLogExpanded)}
            className="w-full flex items-center justify-between text-xs font-black text-purple-650 dark:text-purple-400 uppercase tracking-widest bg-purple-55 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 px-4 py-2.5 rounded-xl border border-purple-100/50 dark:border-purple-900/10 cursor-pointer transition-all"
          >
            <span className="flex items-center gap-1.5">
              <span>🤖</span> AI Agent Activity Log ({liveIssue.agentLog?.length || 0})
            </span>
            <span>{isLogExpanded ? "▲ Hide" : "▼ Expand"}</span>
          </button>
          
          {isLogExpanded && (
            <div className="relative border-l-2 border-purple-200/70 dark:border-purple-900/60 pl-6 ml-3 space-y-5 animate-fadeIn">
              {liveIssue.agentLog && liveIssue.agentLog.length > 0 ? (
                liveIssue.agentLog.map((log, idx) => {
                  const getLogDotColor = (logText) => {
                    const text = logText.toLowerCase();
                    if (text.includes("resolved") || text.includes("resolution") || text.includes("closed") || text.includes("verify")) return "bg-green-500";
                    if (text.includes("sla") || text.includes("escalat") || text.includes("ignored") || text.includes("breach") || text.includes("duplicate")) return "bg-red-500";
                    if (text.includes("route") || text.includes("assign") || text.includes("schedule") || text.includes("milestone")) return "bg-amber-500";
                    return "bg-blue-500";
                  };
                  const dotColor = getLogDotColor(log.status || log.action || "");
                  return (
                    <div key={idx} className="relative text-xs">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full ${dotColor} border-2 border-white dark:border-gray-900 flex items-center justify-center text-[8px] text-white font-extrabold shadow-sm`} />
                      
                      <span className="text-gray-400 dark:text-gray-500 font-extrabold block text-[8px] uppercase tracking-widest mb-0.5">
                        {log.timestamp}
                      </span>
                      <span className="text-gray-850 dark:text-gray-250 font-bold block leading-relaxed">
                        {log.status || log.action}
                      </span>
                      {log.agentReason && (
                        <p className="text-[10px] text-red-500 italic mt-0.5 font-bold">
                          AI Match Match Reason: {log.agentReason}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400">No logs generated yet.</p>
              )}

              {liveIssue.status === "Escalated" && liveIssue.escalationEmail && (
                <div className="relative text-xs pt-1">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[9px] text-white font-extrabold bg-red-500 shadow-sm">!</div>
                  <span className="text-red-500 font-black block text-[8px] uppercase tracking-widest mb-0.5">SLA Escalation Mail</span>
                  <div className="relative group rounded-2xl overflow-hidden border border-gray-800 shadow-lg mt-1.5">
                    <div className="bg-gray-900 px-4 py-2 flex items-center justify-between text-[10px] font-bold text-gray-400 border-b border-gray-800 font-sans">
                      <span>📧 Escalation Draft</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(liveIssue.escalationEmail);
                          alert("Escalation letter copied to clipboard! 📋");
                        }}
                        className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-[9px] font-black shadow transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        📋 Copy Letter
                      </button>
                    </div>
                    <pre className="bg-gray-955 text-gray-300 font-mono text-[10px] p-4 overflow-x-auto max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                      {liveIssue.escalationEmail}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
