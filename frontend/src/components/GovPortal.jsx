import React, { useState } from "react";
import { assignInspector, govResolveIssue } from "../utils/dbService";
import { logMilestone } from "../utils/agentService";

const DEPARTMENTS = [
  "All Departments",
  "Public Works (Roads)",
  "Electricity Board",
  "Sanitation & Waste Management",
  "Water & Sewerage Authority",
  "Parks & Recreation",
  "General Municipal Authority"
];

export default function GovPortal({ issues = [], onIssueUpdated }) {
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("All");
  const [inspectorName, setInspectorName] = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [activeEscalationMail, setActiveEscalationMail] = useState(null);
  const [floatPoints, setFloatPoints] = useState([]);

  const triggerFloatingPoints = (issueId) => {
    const newId = Date.now();
    setFloatPoints(prev => [...prev, { id: newId, issueId }]);
    setTimeout(() => {
      setFloatPoints(prev => prev.filter(p => p.id !== newId));
    }, 1000);
  };

  // Government Portal Actions
  const handleAssignInspector = async (issueId) => {
    if (!inspectorName.trim()) {
      alert("Please enter an inspector's name.");
      return;
    }

    try {
      await assignInspector(issueId, inspectorName);
      alert(`Inspector "${inspectorName}" successfully assigned!`);
      setAssigningId(null);
      setInspectorName("");
      if (onIssueUpdated) onIssueUpdated();
    } catch (error) {
      console.error("Failed to assign inspector:", error);
      alert("Could not assign inspector. Try again.");
    }
  };

  const handleGovResolve = async (issueId) => {
    try {
      await govResolveIssue(issueId);
      triggerFloatingPoints(issueId);
      alert("Issue successfully resolved and closed in system!");
      if (onIssueUpdated) onIssueUpdated();
    } catch (error) {
      console.error("Failed to resolve issue:", error);
      alert("Could not mark issue resolved.");
    }
  };

  const handleMarkMilestoneComplete = async (issueId, idx, stepText) => {
    try {
      await logMilestone(issueId, idx, stepText);
      alert(`Milestone ${idx + 1} marked complete!`);
      if (onIssueUpdated) onIssueUpdated();
    } catch (e) {
      console.error(e);
      alert("Failed to update milestone.");
    }
  };

  // Filter Issues
  const filteredIssues = issues.filter((issue) => {
    const deptMatch =
      selectedDept === "All Departments" || issue.department === selectedDept;
    const statusMatch =
      statusFilter === "All" || issue.status === statusFilter;
    return deptMatch && statusMatch;
  });

  // Calculate quick workload stats
  const getWorkloadStats = () => {
    const stats = {};
    DEPARTMENTS.forEach(d => {
      if (d !== "All Departments") stats[d] = 0;
    });
    issues.forEach((issue) => {
      if (issue.status !== "Resolved" && stats[issue.department] !== undefined) {
        stats[issue.department] += 1;
      }
    });
    return stats;
  };

  const workload = getWorkloadStats();

  const getDeptAccountabilityStats = () => {
    const stats = {};
    DEPARTMENTS.forEach(d => {
      if (d !== "All Departments") {
        stats[d] = { total: 0, resolved: 0 };
      }
    });

    issues.forEach(issue => {
      const dept = issue.department;
      if (stats[dept]) {
        stats[dept].total += 1;
        if (issue.status === "Resolved") {
          stats[dept].resolved += 1;
        }
      }
    });

    return Object.entries(stats).map(([name, data]) => {
      const percentage = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
      let barColor = "#ef4444"; // red (<50%)
      if (percentage >= 80) barColor = "#22c55e"; // green
      else if (percentage >= 50) barColor = "#f59e0b"; // amber

      return {
        name,
        total: data.total,
        resolved: data.resolved,
        percentage,
        barColor
      };
    });
  };

  const accountabilityStats = getDeptAccountabilityStats();

  return (
    <div className="space-y-6">
      {/* Portal Header */}
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-650 p-6 sm:p-8 rounded-3xl text-white shadow-lg border border-indigo-700/50">
        <div className="max-w-3xl">
          <span className="text-[10px] uppercase font-black tracking-widest bg-indigo-500/30 px-3 py-1 rounded-full border border-indigo-400/30 text-indigo-200">
            Internal Municipal Administration Console
          </span>
          <h2 className="text-3xl font-extrabold mt-3 tracking-tight">
            Civic Resolution Portal
          </h2>
          <p className="text-indigo-200 text-sm mt-2 leading-relaxed">
            Monitor real-time citizen grievance reports, assign department inspectors, manage field work orders, and review AI-agent escalation complaints.
          </p>
        </div>
      </div>

      {/* Workload Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Object.entries(workload).map(([dept, count], idx) => (
          <div
            key={idx}
            onClick={() => setSelectedDept(dept)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-24 ${
              selectedDept === dept
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-[1.02]"
                : "bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 text-gray-800 dark:text-gray-200"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-2 leading-tight">
              {dept.replace(" (Roads)", "").replace(" & Waste Management", "").replace(" & Sewerage Authority", "")}
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-black ${selectedDept === dept ? "text-white" : "text-indigo-600 dark:text-indigo-450"}`}>
                {count}
              </span>
              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                active
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Department Accountability Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-150 dark:border-gray-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
            Department Performance & Accountability
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time visual audit showing resolution percentages. Colored dynamically by SLA compliance performance.
          </p>
        </div>

        <div className="space-y-4">
          {accountabilityStats.map((dept, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="sm:w-1/3 min-w-[200px]">
                <span className="text-xs font-bold text-gray-705 dark:text-gray-300 block truncate">
                  {dept.name}
                </span>
                <span className="text-[10px] font-semibold text-gray-405 block mt-0.5">
                  {dept.resolved} of {dept.total} tickets resolved
                </span>
              </div>
              <div className="flex-1 flex items-center gap-3">
                <svg className="w-full h-5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200/20 dark:border-gray-700/20 overflow-hidden" style={{ minWidth: "120px" }}>
                  <rect
                    x="0"
                    y="0"
                    width={`${dept.percentage}%`}
                    height="100%"
                    fill={dept.barColor}
                    rx="10"
                    ry="10"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <span className="text-xs font-black text-gray-900 dark:text-white min-w-[32px] text-right">
                  {dept.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-150 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-gray-800 dark:text-white uppercase tracking-wider">
            Consoles Filters
          </h3>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Issue Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Reported">Reported (New)</option>
              <option value="Assigned">Assigned (In Progress)</option>
              <option value="Escalated">Escalated (SLA Breached)</option>
              <option value="Resolved">Resolved (Closed)</option>
            </select>
          </div>

          <div className="pt-2 text-[10px] text-gray-400 dark:text-gray-500 font-semibold leading-relaxed border-t border-gray-100 dark:border-gray-800">
            🔔 <strong>SLA Rule:</strong> Issues pending resolution for more than 7 days trigger autonomous escalation.
          </div>
        </div>

        {/* Console Action List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-extrabold text-lg text-gray-800 dark:text-white">
              Grievance List ({filteredIssues.length})
            </h3>
            <span className="text-xs text-gray-400">
              Showing filtered results
            </span>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-150 dark:border-gray-800 p-12 text-center text-gray-400">
              <span className="text-3xl block mb-2">🎉</span>
              No active tickets found matching these filters. All clean!
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="premium-card rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md border border-gray-150 dark:border-gray-850 relative group"
              >
                {/* Media thumbnail */}
                <div className="w-full md:w-44 h-36 md:h-auto relative overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-950">
                  {issue.isVideo || (issue.imageUrl && (issue.imageUrl.toLowerCase().includes(".mp4") || issue.imageUrl.toLowerCase().includes(".mov") || issue.imageUrl.toLowerCase().includes(".webm"))) ? (
                    <video
                      src={issue.imageUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={issue.imageUrl || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80"}
                      alt={issue.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  )}
                  <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md ${
                    issue.status === "Resolved" ? "bg-green-500 text-white" :
                    issue.status === "Escalated" ? "bg-red-600 text-white animate-pulse" :
                    issue.status === "Assigned" ? "bg-indigo-650 text-white" : "bg-gray-500 text-white"
                  }`}>
                    {issue.status}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md border border-indigo-100/30 dark:border-indigo-800/10">
                        {issue.category}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">📅 {issue.createdAt}</span>
                    </div>

                    <h4 className="font-extrabold text-base text-gray-950 dark:text-white leading-tight">
                      {issue.title}
                    </h4>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed font-semibold">
                      {issue.description}
                    </p>

                    {issue.locationName && (
                      <p className="text-[10px] text-indigo-650 dark:text-indigo-400 font-extrabold mt-2 flex items-center gap-1">
                        <span>📍</span> <span className="leading-tight">{issue.locationName}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold border border-gray-150 dark:border-gray-700">
                        Severity: {issue.severity}/5
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold border border-gray-150 dark:border-gray-700">
                        Upvotes: {issue.upvotes || 0}
                      </span>
                      {issue.reportedBy && (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-450 font-bold border border-purple-100/50 dark:border-purple-900/10">
                          👤 {issue.reportedBy}
                        </span>
                      )}
                    </div>

                    {issue.status === "Assigned" && issue.actionPlan && (
                      <div className="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl p-4 space-y-3 mt-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 block">
                          🚧 AI Work Order Milestones
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {issue.actionPlan.map((step, idx) => {
                            const currentIdx = issue.currentMilestone || 0;
                            const isActive = idx === currentIdx;
                            const isCompleted = idx < currentIdx;
                            
                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                                  isActive
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm scale-[1.02]"
                                    : isCompleted
                                    ? "bg-green-50/55 border-green-200 text-green-800 dark:bg-green-950/10 dark:border-green-900/20 dark:text-green-400"
                                    : "bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700"
                                }`}
                              >
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-wider block mb-1">
                                    Step {idx + 1} {isCompleted ? "✓ Done" : isActive ? "⚡ Active" : "Pending"}
                                  </span>
                                  <p className="text-xs font-bold leading-snug">{step}</p>
                                </div>
                                
                                {isActive && (
                                  <button
                                    onClick={() => handleMarkMilestoneComplete(issue.id, idx, step)}
                                    className="w-full text-center py-1.5 bg-white text-indigo-750 hover:bg-indigo-50 font-black text-[10px] rounded-lg transition-colors cursor-pointer active:scale-95 mt-2"
                                  >
                                    Mark step complete
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Inspector display */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs">
                      {issue.inspector ? (
                        <span className="text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1">
                          <span>👷</span> Assigned Inspector: <strong className="text-gray-800 dark:text-white font-extrabold">{issue.inspector}</strong>
                        </span>
                      ) : (
                        <span className="text-red-550 font-black flex items-center gap-1 text-[11px] bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-lg border border-red-100/40">
                          <span>⚠️</span> Unassigned Field Crew
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {/* View Escalation Complaint */}
                      {issue.escalationEmail && (
                        <button
                          onClick={() => setActiveEscalationMail(issue.escalationEmail)}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-655 dark:text-red-400 rounded-xl text-xs font-bold transition shadow-sm border border-red-200 dark:border-red-900/20 cursor-pointer"
                        >
                          📩 View Escalation Letter
                        </button>
                      )}

                      {/* Action buttons */}
                      {issue.status !== "Resolved" && (
                        <>
                          {assigningId === issue.id ? (
                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-850 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                              <input
                                type="text"
                                placeholder="Inspector Name"
                                value={inspectorName}
                                onChange={(e) => setInspectorName(e.target.value)}
                                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-lg text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                              />
                              <button
                                onClick={() => handleAssignInspector(issue.id)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-black text-xs cursor-pointer shadow-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setAssigningId(null)}
                                className="px-2 py-1.5 bg-gray-400 hover:bg-gray-550 text-white rounded-lg font-bold text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningId(issue.id)}
                              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/25 dark:hover:bg-indigo-900/40 text-indigo-655 dark:text-indigo-400 rounded-xl text-xs font-black transition shadow-sm border border-indigo-150 dark:border-indigo-900/30 cursor-pointer"
                            >
                              👷 Assign Inspector
                            </button>
                          )}

                          {(issue.status === "Escalated" || (issue.status === "Assigned" && issue.currentMilestone === 3)) && (
                            <div className="relative">
                              <button
                                onClick={() => handleGovResolve(issue.id)}
                                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer hover:shadow-lg active:scale-[0.97]"
                              >
                                ✓ Mark Resolved
                              </button>
                              {floatPoints.some(p => p.issueId === issue.id) && (
                                <div className="float-up-points absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md z-20 border border-yellow-400">
                                  +100 pts
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Escalation Letter Modal */}
      {activeEscalationMail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl border border-gray-250 dark:border-gray-800">
            <div className="p-5 bg-gradient-to-r from-red-700 to-red-650 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <h4 className="font-black text-xs uppercase tracking-wider">
                  Autonomous SLA Escalation Letter
                </h4>
              </div>
              <button
                onClick={() => setActiveEscalationMail(null)}
                className="text-white hover:text-gray-205 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                This official complaint letter was drafted autonomously by the CivicAI Advocate Agent using Gemini Flash, triggered by an unresolved SLA breach (exceeding 7 days).
              </p>
              <pre className="bg-gray-950 text-gray-300 font-mono text-[10px] p-4 rounded-xl overflow-y-auto max-h-60 leading-relaxed whitespace-pre-wrap border border-gray-800 shadow-inner">
                {activeEscalationMail}
              </pre>
            </div>
            <div className="bg-gray-50 dark:bg-gray-850 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeEscalationMail);
                  alert("Copied to clipboard! 📋");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm cursor-pointer"
              >
                📋 Copy Letter
              </button>
              <button
                onClick={() => setActiveEscalationMail(null)}
                className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black border border-gray-200 dark:border-gray-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
