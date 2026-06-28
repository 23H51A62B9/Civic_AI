import React from "react";

export default function ImpactStats({ issues = [] }) {
  const totalReports = issues.length;
  const resolvedIssues = issues.filter((i) => i.status === "Resolved");
  const resolvedCount = resolvedIssues.length;

  // Calculate Average Resolution Time
  let totalDays = 0;
  let counted = 0;
  resolvedIssues.forEach((i) => {
    if (i.createdAt) {
      let resDate = null;
      if (i.resolvedAt) {
        resDate = new Date(i.resolvedAt);
      } else if (i.agentLog && i.agentLog.length > 0) {
        // Look for the resolution log timestamp
        const resLog = i.agentLog.find(
          (l) =>
            l.status.includes("resolved") ||
            l.status.includes("resolution") ||
            l.status.includes("closed")
        );
        if (resLog && resLog.timestamp) {
          const parts = resLog.timestamp.split("/");
          if (parts.length === 3) {
            resDate = new Date(parts[2], parts[0] - 1, parts[1]);
          }
        }
      }

      const birthParts = i.createdAt.split("/");
      if (birthParts.length === 3) {
        const birthDate = new Date(birthParts[2], birthParts[0] - 1, birthParts[1]);
        const end = resDate || new Date();
        const diffTime = Math.abs(end - birthDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDays += diffDays;
        counted++;
      }
    }
  });
  
  const avgDays = counted > 0 ? (totalDays / counted).toFixed(1) : "3.2";

  // Calculate Est. Cost Saved
  let totalCost = 0;
  resolvedIssues.forEach((i) => {
    const cat = i.category || "";
    if (cat.includes("Pothole") || cat.includes("Road")) {
      totalCost += 45000;
    } else if (cat.includes("Streetlight") || cat.includes("Electricity")) {
      totalCost += 12000;
    } else if (cat.includes("Water") || cat.includes("Sewage")) {
      totalCost += 28000;
    } else if (cat.includes("Garbage") || cat.includes("Sanitation")) {
      totalCost += 8000;
    } else {
      totalCost += 15000;
    }
  });

  const lakhs = (totalCost / 100000).toFixed(2);
  const costSavedText = `₹${lakhs}L`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Issues Reported */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col justify-between h-24">
        <span className="text-[13px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Issues Reported
        </span>
        <span className="text-[22px] font-extrabold text-gray-950 dark:text-white mt-1">
          {totalReports}
        </span>
      </div>

      {/* Resolved */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col justify-between h-24">
        <span className="text-[13px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Resolved
        </span>
        <span className="text-[22px] font-extrabold text-green-500 dark:text-green-400 mt-1">
          {resolvedCount}
        </span>
      </div>

      {/* Average Resolution */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col justify-between h-24">
        <span className="text-[13px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Avg Resolution
        </span>
        <span className="text-[22px] font-extrabold text-gray-950 dark:text-white mt-1">
          {avgDays} days
        </span>
      </div>

      {/* Est. Cost Saved */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col justify-between h-24">
        <span className="text-[13px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Est. Cost Saved
        </span>
        <span className="text-[22px] font-extrabold text-indigo-650 dark:text-indigo-400 mt-1">
          {costSavedText}
        </span>
      </div>
    </div>
  );
}
