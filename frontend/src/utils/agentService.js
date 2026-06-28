import axios from "axios";
import { db } from "../firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

/**
 * Triggers autonomous SLA Audit via Cloud Run backend with client-side fallback.
 */
export const triggerSlaAudit = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/sla-audit`);
    console.log("SLA Audit complete via backend:", res.data);
    return res.data;
  } catch (error) {
    console.warn("Backend SLA Audit failed, falling back to client-side audit:", error.message);
    throw error;
  }
};

/**
 * Sends a milestone log entry to Firestore to record progress.
 */
export const logMilestone = async (issueId, milestoneIndex, milestoneText) => {
  const logEntry = {
    timestamp: new Date().toLocaleDateString(),
    status: `[AI Milestone Tracking] Step ${milestoneIndex + 1} completed: ${milestoneText}.`
  };

  if (!issueId.startsWith("local-")) {
    try {
      const issueRef = doc(db, "issues", issueId);
      await updateDoc(issueRef, {
        currentMilestone: milestoneIndex + 1,
        agentLog: arrayUnion(logEntry)
      });
    } catch (e) {
      console.warn("Failed to update milestone in Firestore:", e);
    }
  }

  // Update local storage
  try {
    const localStr = localStorage.getItem("civicai_issues");
    if (localStr) {
      const local = JSON.parse(localStr);
      const updated = local.map(issue => {
        if (issue.id === issueId) {
          return {
            ...issue,
            currentMilestone: milestoneIndex + 1,
            agentLog: [...(issue.agentLog || []), logEntry]
          };
        }
        return issue;
      });
      localStorage.setItem("civicai_issues", JSON.stringify(updated));
      // Trigger update event to notify listeners
      window.dispatchEvent(new Event("localIssuesChanged"));
    }
  } catch (e) {
    console.error("Local storage milestone log failed:", e);
  }
};
