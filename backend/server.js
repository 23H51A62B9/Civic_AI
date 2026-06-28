const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, addDoc, updateDoc, doc, arrayUnion, increment } = require("firebase/firestore");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

// Distance helper
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

// 1. SLA Audit Endpoint (Triggered by Cloud Scheduler every 24 hours)
app.post("/api/sla-audit", async (req, res) => {
  console.log("Starting autonomous SLA Audit...");
  try {
    const querySnapshot = await getDocs(collection(db, "issues"));
    const issues = [];
    querySnapshot.forEach((doc) => {
      issues.push({ id: doc.id, ...doc.data() });
    });

    const escalated = [];

    for (const issue of issues) {
      if (issue.status === "Reported" || issue.status === "Assigned") {
        if (!issue.createdAt) continue;
        const parts = issue.createdAt.split("/");
        if (parts.length !== 3) continue;

        const createdDate = new Date(parts[2], parts[0] - 1, parts[1]);
        const today = new Date();
        const diffTime = Math.abs(today - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 7) {
          console.log(`Issue "${issue.title}" breached SLA (${diffDays} days). Escalating...`);
          
          // Call Gemini to draft escalation email
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
          const prompt = `Write a formal, firm, and professional escalation letter/email from an AI Citizen Advocate agent on behalf of the community.
          
          Details of the ignored issue:
          - Title: ${issue.title}
          - Category: ${issue.category}
          - Description: ${issue.description}
          - Location: ${issue.locationName || `${issue.latitude}, ${issue.longitude}`}
          - Responsible Department: ${issue.department}
          - Date Reported: ${issue.createdAt}
          - Severity: ${issue.severity}/5
          - Days Ignored: ${diffDays} days (SLA Breached)
          
          The email should be addressed to the Chief Municipal Officer / District Commissioner. Demand urgent action. Keep it under 200 words. Return raw text without markdown.`;

          const payload = {
            contents: [{ parts: [{ text: prompt }] }]
          };

          let emailBody = "Escalation initiated due to SLA breach.";
          try {
            const geminiRes = await axios.post(geminiUrl, payload);
            emailBody = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || emailBody;
          } catch (geminiErr) {
            console.error("Gemini failed to draft escalation email:", geminiErr.message);
          }

          // Update Firestore doc
          const issueRef = doc(db, "issues", issue.id);
          await updateDoc(issueRef, {
            status: "Escalated",
            escalationEmail: emailBody,
            agentLog: arrayUnion(
              { timestamp: today.toLocaleDateString(), status: `Alert! ${diffDays} days SLA threshold breached.` },
              { timestamp: today.toLocaleDateString(), status: "AI Agent automatically drafted and dispatched escalation complaint to Chief Officer." }
            )
          });
          escalated.push(issue.id);
        }
      }
    }

    res.json({ success: true, escalatedCount: escalated.length, escalatedIds: escalated });
  } catch (err) {
    console.error("SLA Audit failed:", err);
    res.status(500).json({ error: "SLA Audit failed", details: err.message });
  }
});

// 2. Gemini-powered Duplicate Detection
app.post("/api/check-duplicate", async (req, res) => {
  const { category, latitude, longitude, title, description } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Location coordinates required" });
  }

  console.log(`Checking duplicates for new report: "${title}" near ${latitude}, ${longitude}`);

  try {
    const querySnapshot = await getDocs(collection(db, "issues"));
    const activeIssues = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status !== "Resolved") {
        activeIssues.push({ id: doc.id, ...data });
      }
    });

    // 1. Proximity filter (within 100 meters)
    const nearbyIssues = activeIssues.filter(issue => {
      const dist = getDistanceInMeters(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(issue.latitude),
        parseFloat(issue.longitude)
      );
      return dist <= 100 && issue.category === category;
    });

    if (nearbyIssues.length === 0) {
      return res.json({ isDuplicate: false });
    }

    console.log(`Found ${nearbyIssues.length} nearby issues matching category. Performing AI comparison...`);

    // 2. Compare descriptions using Gemini
    for (const existing of nearbyIssues) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const prompt = `Compare these two infrastructure issues reported in the same location:
      
      Issue A (Existing):
      - Title: ${existing.title}
      - Description: ${existing.description}
      
      Issue B (New Report):
      - Title: ${title}
      - Description: ${description}
      
      Determine if they are describing the exact same physical problem (e.g. the exact same pothole, the exact same broken pole, the exact same pile of trash).
      Respond ONLY with a valid JSON object matching this schema:
      {
        "isDuplicate": true or false,
        "reason": "Brief explanation of why it is or is not the same physical issue"
      }
      Do not include any markdown format tags like \`\`\`json.`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }]
      };

      try {
        const geminiRes = await axios.post(geminiUrl, payload);
        const text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const cleanedText = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const result = JSON.parse(cleanedText);

        if (result.isDuplicate) {
          console.log(`Duplicate confirmed by Gemini with existing issue ID: ${existing.id}`);

          // Merge: Increment upvote and append log to existing issue
          const issueRef = doc(db, "issues", existing.id);
          await updateDoc(issueRef, {
            upvotes: increment(1),
            agentLog: arrayUnion({
              timestamp: new Date().toLocaleDateString(),
              status: `Duplicate report merged from community member. Upvote incremented.`
            })
          });

          return res.json({
            isDuplicate: true,
            duplicateOf: existing.id,
            existingTitle: existing.title,
            reason: result.reason
          });
        }
      } catch (err) {
        console.error("Gemini duplicate check failed:", err.message);
      }
    }

    res.json({ isDuplicate: false });
  } catch (err) {
    console.error("Duplicate check failed:", err);
    res.status(500).json({ error: "Duplicate check failed", details: err.message });
  }
});

// 3. Gemini Vision proxy (for security and reliability)
app.post("/api/gemini-vision", async (req, res) => {
  const { base64Data, mimeType } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: "base64Data is required" });
  }

  console.log("Analyzing image via backend proxy...");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Analyze this image of a civic/infrastructure issue. Provide your response as a valid JSON object with the following keys:
  - category: one of ["Pothole/Road Damage", "Broken Streetlight/Electricity", "Garbage/Sanitation", "Water Leakage/Sewage", "Public Facility Damage", "Other"]
  - severity: integer from 1 (minor/cosmetic) to 5 (extreme safety hazard)
  - title: a short, descriptive title
  - description: a concise explanation of the issue and its impact
  - department: responsible department, select one from ["Public Works (Roads)", "Electricity Board", "Sanitation & Waste Management", "Water & Sewerage Authority", "Parks & Recreation", "General Municipal Authority"]
  - actionPlan: an array of 3 milestone steps to track resolution
  
  Return ONLY the raw JSON string. Do not include markdown wraps.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(url, payload);
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Empty analysis text from Gemini");
    }

    const cleanedText = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    res.json(JSON.parse(cleanedText));
  } catch (err) {
    console.error("Gemini Vision proxy failed:", err.message);
    res.status(500).json({ error: "AI Vision analysis failed", details: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`CivicAI Backend Server listening on port ${PORT}`);
});
