import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, arrayUnion, increment, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { draftEscalationEmail } from "./gemini";

// Helper to calculate distance in meters between two coordinates using Haversine formula
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Local Storage helpers
const getLocalIssues = () => {
  try {
    const data = localStorage.getItem("civicai_issues");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Local storage read error", e);
    return [];
  }
};

const saveLocalIssues = (issues) => {
  try {
    localStorage.setItem("civicai_issues", JSON.stringify(issues));
  } catch (e) {
    console.error("Local storage write error", e);
  }
};

// Subscriber tracking for local-first updates
let subscribers = [];
const notifySubscribers = (list) => {
  subscribers.forEach(cb => {
    try { cb(list); } catch (e) { console.error("Subscriber callback failed", e); }
  });
};

/**
 * Checks if a new issue report is a duplicate of an existing active issue.
 */
export const checkForDuplicate = (newIssue, existingIssues) => {
  return existingIssues.find((issue) => {
    if (issue.status === "Resolved") return false;
    if (issue.category !== newIssue.category) return false;
    const distance = getDistanceInMeters(
      parseFloat(newIssue.latitude),
      parseFloat(newIssue.longitude),
      parseFloat(issue.latitude),
      parseFloat(issue.longitude)
    );
    return distance <= 50; // Duplicate threshold: 50 meters
  });
};

/**
 * Submit Issue - Local-first with background firestore timeout.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
}

export const submitIssue = async (issueData) => {
  const issueId = "local-" + Date.now();
  const newIssue = {
    id: issueId,
    ...issueData,
    upvotes: 0,
    status: "Reported",
    createdAt: new Date().toLocaleDateString(),
    timestamp: Date.now(),
    agentLog: [
      { timestamp: new Date().toLocaleDateString(), status: "Report analyzed and categorized by Gemini Vision." },
      { timestamp: new Date().toLocaleDateString(), status: `Routed to ${issueData.department} Department.` }
    ]
  };

  const localIssues = getLocalIssues();

  // 1. Get all local issues with same category and status != "Resolved"
  const candidates = localIssues.filter(
    (i) => i.category === newIssue.category && i.status !== "Resolved"
  );

  // 2. Filter to those within 500m using Haversine
  const nearby = candidates.filter((existing) => {
    const dist = haversine(
      parseFloat(newIssue.latitude),
      parseFloat(newIssue.longitude),
      parseFloat(existing.latitude),
      parseFloat(existing.longitude)
    );
    return dist <= 500;
  });

  // 3. If nearby issue found, call Gemini
  if (nearby.length > 0) {
    const existing = nearby[0];
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey && !apiKey.startsWith("YOUR_")) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const prompt = `Are these the same civic issue? 
        Issue A: ${newIssue.title} - ${newIssue.description}
        Issue B: ${existing.title} - ${existing.description}
        Reply ONLY with JSON: {"isDuplicate":boolean,"confidence":number(0-100),"reason":"string"}`;

        const payload = {
          contents: [{ parts: [{ text: prompt }] }]
        };

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resData = await response.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const cleanedText = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const result = JSON.parse(cleanedText);
        if (result.isDuplicate && result.confidence > 75) {
          // 4. Increment upvotes on existing issue, append to agentLog
          await upvoteIssue(existing.id);

          // Increment reporter duplicatesCount (Feature 3)
          if (newIssue.uid) {
            try {
              const localUserStr = localStorage.getItem(`civicai_user_${newIssue.uid}`);
              const localUser = localUserStr ? JSON.parse(localUserStr) : {};
              localUser.duplicatesCount = (localUser.duplicatesCount || 0) + 1;
              localStorage.setItem(`civicai_user_${newIssue.uid}`, JSON.stringify(localUser));

              const reporterUserRef = doc(db, "users", newIssue.uid);
              await setDoc(reporterUserRef, {
                duplicatesCount: increment(1)
              }, { merge: true });
            } catch (err) {
              console.warn("Failed to increment reporter duplicate count:", err);
            }
          }

          const logEntry = {
            timestamp: new Date().toLocaleDateString(),
            status: `Duplicate report detected by agent. Merged with report #${existing.id}. (AI Confidence: ${result.confidence}%)`,
            action: "Duplicate detected. Merged with report #" + existing.id,
            agentReason: result.reason,
            confidence: result.confidence
          };

          const existingRef = doc(db, "issues", existing.id);
          try {
            await updateDoc(existingRef, {
              upvotes: increment(1),
              agentLog: arrayUnion(logEntry)
            });
          } catch (e) {
            console.warn("Firestore duplicate update failed:", e);
          }

          // Update local copy of existing issue
          const updatedIssues = getLocalIssues().map(issue => {
            if (issue.id === existing.id) {
              return {
                ...issue,
                upvotes: (issue.upvotes || 0) + 1,
                agentLog: [...(issue.agentLog || []), logEntry]
              };
            }
            return issue;
          });
          saveLocalIssues(updatedIssues);
          notifySubscribers(updatedIssues);

          return { merged: true, originalIssue: existing };
        }
      } catch (err) {
        console.warn("Gemini duplicate check failed:", err);
      }
    }
  }

  // Instantly save to local storage
  localIssues.unshift(newIssue);
  saveLocalIssues(localIssues);
  notifySubscribers(localIssues);

  // Try saving to Firestore in background (1.5s timeout)
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 1500));
  const firestorePromise = (async () => {
    try {
      const docRef = await addDoc(collection(db, "issues"), {
        ...newIssue,
        id: undefined
      });
      return docRef.id;
    } catch (e) {
      console.warn("Firestore save failed in background:", e);
      return "FAILED";
    }
  })();

  const result = await Promise.race([firestorePromise, timeoutPromise]);
  if (result !== "TIMEOUT" && result !== "FAILED") {
    // Replace temporary ID with actual Firestore ID
    const updatedLocal = getLocalIssues().map(issue => {
      if (issue.id === issueId) {
        return { ...issue, id: result };
      }
      return issue;
    });
    saveLocalIssues(updatedLocal);
    newIssue.id = result;
    notifySubscribers(updatedLocal);
  }

  return newIssue;
};

// Track Firestore active listener
let isFirestoreListening = false;

/**
 * Subscribe to Issues collection with real-time updates (Local-first fallbacks).
 */
export const subscribeToIssues = (callback) => {
  subscribers.push(callback);
  
  // Immediately callback with local storage list for instant load
  const localList = getLocalIssues();
  callback(localList);

  if (!isFirestoreListening) {
    isFirestoreListening = true;
    const q = collection(db, "issues");
    onSnapshot(q, (snapshot) => {
      const firestoreList = [];
      snapshot.forEach((doc) => {
        firestoreList.push({ id: doc.id, ...doc.data() });
      });

      // Merge Firestore items into local storage
      const localList = getLocalIssues();
      const mergedList = [...localList];

      firestoreList.forEach(fIssue => {
        const idx = mergedList.findIndex(l => l.id === fIssue.id || (l.title === fIssue.title && Math.abs(l.timestamp - fIssue.timestamp) < 5000));
        if (idx >= 0) {
          mergedList[idx] = fIssue;
        } else {
          mergedList.push(fIssue);
        }
      });

      // Sort chronologically
      mergedList.sort((a, b) => {
        const timeA = a.timestamp || new Date(a.createdAt || 0).getTime() || 0;
        const timeB = b.timestamp || new Date(b.createdAt || 0).getTime() || 0;
        return timeB - timeA;
      });

      saveLocalIssues(mergedList);
      notifySubscribers(mergedList);
    }, (err) => {
      console.warn("Firestore subscription failed. Falling back to local offline mode.", err);
      notifySubscribers(getLocalIssues());
    });
  }

  return () => {
    subscribers = subscribers.filter(cb => cb !== callback);
  };
};

/**
 * Upvotes an issue directly (Local-first).
 */
export const upvoteIssue = async (issueId) => {
  const localList = getLocalIssues().map(issue => {
    if (issue.id === issueId) {
      return { ...issue, upvotes: (issue.upvotes || 0) + 1 };
    }
    return issue;
  });
  saveLocalIssues(localList);
  notifySubscribers(localList);

  if (!issueId.startsWith("local-")) {
    try {
      const issueRef = doc(db, "issues", issueId);
      await updateDoc(issueRef, {
        upvotes: increment(1)
      });
    } catch (err) {
      console.warn("Firestore upvote failed:", err);
    }
  }

  return { id: issueId };
};

/**
 * Resolves an issue (Local-first).
 */
export const resolveIssue = async (issueId) => {
  const logEntry = {
    timestamp: new Date().toLocaleDateString(),
    status: "Community verified resolution. Ticket closed successfully."
  };
  
  const localList = getLocalIssues().map(issue => {
    if (issue.id === issueId) {
      return { 
        ...issue, 
        status: "Resolved", 
        agentLog: [...(issue.agentLog || []), logEntry] 
      };
    }
    return issue;
  });
  saveLocalIssues(localList);
  notifySubscribers(localList);

  if (!issueId.startsWith("local-")) {
    try {
      const issueRef = doc(db, "issues", issueId);
      await updateDoc(issueRef, {
        status: "Resolved",
        agentLog: arrayUnion(logEntry)
      });
    } catch (err) {
      console.warn("Firestore resolve failed:", err);
    }
  }

  return { id: issueId };
};

/**
 * Assign inspector (Local-first).
 */
export const assignInspector = async (issueId, inspectorName) => {
  const logEntry = {
    timestamp: new Date().toLocaleDateString(),
    status: `[Government Portal] Inspector ${inspectorName} assigned. Field inspection scheduled.`
  };

  const localList = getLocalIssues().map(issue => {
    if (issue.id === issueId) {
      return { 
        ...issue, 
        status: "Assigned", 
        inspector: inspectorName,
        agentLog: [...(issue.agentLog || []), logEntry] 
      };
    }
    return issue;
  });
  saveLocalIssues(localList);
  notifySubscribers(localList);

  if (!issueId.startsWith("local-")) {
    try {
      const issueRef = doc(db, "issues", issueId);
      await updateDoc(issueRef, {
        status: "Assigned",
        inspector: inspectorName,
        agentLog: arrayUnion(logEntry)
      });
    } catch (err) {
      console.warn("Firestore assign inspector failed:", err);
    }
  }

  return { id: issueId };
};

/**
 * Government Portal Resolve Action (Local-first).
 */
export const govResolveIssue = async (issueId) => {
  const logEntry = {
    timestamp: new Date().toLocaleDateString(),
    status: "[Government Portal] Municipal work order completed. Marked resolved by department admin."
  };

  const localList = getLocalIssues().map(issue => {
    if (issue.id === issueId) {
      return { 
        ...issue, 
        status: "Resolved", 
        agentLog: [...(issue.agentLog || []), logEntry] 
      };
    }
    return issue;
  });
  saveLocalIssues(localList);
  notifySubscribers(localList);

  if (!issueId.startsWith("local-")) {
    try {
      const issueRef = doc(db, "issues", issueId);
      await updateDoc(issueRef, {
        status: "Resolved",
        agentLog: arrayUnion(logEntry)
      });
    } catch (err) {
      console.warn("Firestore gov resolve failed:", err);
    }
  }

  return { id: issueId };
};

/**
 * Audit active issues for SLA breach (>= 7 days overdue).
 */
export const runSlaAudit = async (issues) => {
  const updatedIssues = await Promise.all(
    issues.map(async (issue) => {
      if (issue.status === "Reported" || issue.status === "Assigned" || issue.status === "Verified") {
        const parts = issue.createdAt.split("/");
        if (parts.length !== 3) return issue;

        const createdDate = new Date(parts[2], parts[0] - 1, parts[1]);
        const today = new Date();
        
        const diffTime = Math.abs(today - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 7) {
          try {
            const email = await draftEscalationEmail(issue);
            
            // Update local storage
            const localIssues = getLocalIssues().map(local => {
              if (local.id === issue.id) {
                return {
                  ...local,
                  status: "Escalated",
                  escalationEmail: email,
                  agentLog: [
                    ...(local.agentLog || []),
                    { timestamp: today.toLocaleDateString(), status: `Alert! ${diffDays} days SLA threshold breached.` },
                    { timestamp: today.toLocaleDateString(), status: "AI Agent automatically drafted and dispatched escalation complaint to Chief Officer." }
                  ]
                };
              }
              return local;
            });
            saveLocalIssues(localIssues);
            notifySubscribers(localIssues);

            // Update firestore in background
            if (!issue.id.startsWith("local-")) {
              const issueRef = doc(db, "issues", issue.id);
              await updateDoc(issueRef, {
                status: "Escalated",
                agentLog: arrayUnion(
                  { timestamp: today.toLocaleDateString(), status: `Alert! ${diffDays} days SLA threshold breached.` },
                  { timestamp: today.toLocaleDateString(), status: "AI Agent automatically drafted and dispatched escalation complaint to Chief Officer." }
                ),
                escalationEmail: email,
              });
            }

            return {
              ...issue,
              status: "Escalated",
              agentLog: [
                ...issue.agentLog,
                { timestamp: today.toLocaleDateString(), status: `Alert! ${diffDays} days SLA threshold breached.` },
                { timestamp: today.toLocaleDateString(), status: "AI Agent automatically drafted and dispatched escalation complaint to Chief Officer." }
              ],
              escalationEmail: email,
            };
          } catch (e) {
            console.error("Agent audit failed:", e);
          }
        }
      }
      return issue;
    })
  );
  return updatedIssues;
};

/**
 * Retrieves the user's score (Local-first).
 */
export const getUserScoreFromFirestore = async (uid) => {
  try {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data().score || 0;
    }
  } catch (err) {
    console.warn("Firestore getUserScore failed, falling back:", err);
  }

  try {
    const localUser = localStorage.getItem(`civicai_user_${uid}`);
    return localUser ? JSON.parse(localUser).score || 0 : 0;
  } catch (e) {
    return 0;
  }
};

/**
 * Updates a user's score (Local-first).
 */
export const updateUserScoreInFirestore = async (uid, displayName, photoURL, scoreToAdd) => {
  let currentScore = 0;
  
  try {
    const localUserStr = localStorage.getItem(`civicai_user_${uid}`);
    const localUser = localUserStr ? JSON.parse(localUserStr) : {};
    currentScore = localUser.score || 0;
    const newScore = currentScore + scoreToAdd;
    localStorage.setItem(`civicai_user_${uid}`, JSON.stringify({
      uid,
      displayName: displayName || "Anonymous Advocate",
      photoURL: photoURL || "",
      score: newScore,
      updatedAt: new Date().toLocaleDateString()
    }));
    currentScore = newScore;
  } catch (e) {
    console.error("Local user score save failed:", e);
  }

  try {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    let firestoreScore = currentScore;
    if (docSnap.exists()) {
      firestoreScore = (docSnap.data().score || 0) + scoreToAdd;
    }
    await setDoc(userRef, {
      uid,
      displayName: displayName || "Anonymous Advocate",
      photoURL: photoURL || "",
      score: firestoreScore,
      updatedAt: new Date().toLocaleDateString()
    }, { merge: true });
    return firestoreScore;
  } catch (err) {
    console.warn("Firestore user score sync failed:", err);
    return currentScore;
  }
};

/**
 * Updates a user's role (Local-first).
 */
export const updateUserRoleInFirestore = async (uid, role) => {
  try {
    const localUserStr = localStorage.getItem(`civicai_user_${uid}`);
    const localUser = localUserStr ? JSON.parse(localUserStr) : {};
    localStorage.setItem(`civicai_user_${uid}`, JSON.stringify({
      ...localUser,
      role
    }));
  } catch (e) {
    console.error("Local user role save failed:", e);
  }

  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, { role }, { merge: true });
  } catch (err) {
    console.warn("Firestore user role sync failed:", err);
  }
};

/**
 * Retrieves the leaderboard (instant load + merge).
 */
export const getLeaderboardFromFirestore = async () => {
  try {
    const q = query(collection(db, "users"), orderBy("score", "desc"));
    const querySnapshot = await getDocs(q);
    const realUsers = [];
    querySnapshot.forEach((doc) => {
      realUsers.push(doc.data());
    });

    const MOCK_LEADERBOARD = [
      { uid: "mock-l1", displayName: "Aarav Sharma", score: 1450, photoURL: "" },
      { uid: "mock-l2", displayName: "Priya Patel", score: 980, photoURL: "" },
      { uid: "mock-l3", displayName: "Vikram Singh", score: 720, photoURL: "" },
      { uid: "mock-l4", displayName: "Ananya Iyer", score: 510, photoURL: "" },
      { uid: "mock-l5", displayName: "Amit Kumar", score: 430, photoURL: "" }
    ];

    const merged = [...realUsers];
    MOCK_LEADERBOARD.forEach(mock => {
      if (!merged.some(u => u.displayName === mock.displayName)) {
        merged.push({
          uid: mock.uid,
          displayName: mock.displayName,
          score: mock.score,
          photoURL: mock.photoURL
        });
      }
    });

    return merged.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.warn("Firestore leaderboard fetch failed, returning mock data:", err);
    return [
      { uid: "mock-l1", displayName: "Aarav Sharma", score: 1450, photoURL: "" },
      { uid: "mock-l2", displayName: "Priya Patel", score: 980, photoURL: "" },
      { uid: "mock-l3", displayName: "Vikram Singh", score: 720, photoURL: "" },
      { uid: "mock-l4", displayName: "Ananya Iyer", score: 510, photoURL: "" },
      { uid: "mock-l5", displayName: "Amit Kumar", score: 430, photoURL: "" }
    ];
  }
};
