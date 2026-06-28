import axios from "axios";

// Helper to convert a File object to a base64 string
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Analyzes an image of a civic issue using Gemini 2.5 Flash.
 * @param {string} base64Data - Base64 encoded image string (without data url prefix)
 * @param {string} mimeType - The MIME type of the image (e.g., "image/jpeg")
 * @returns {Promise<Object>} The parsed JSON analysis of the issue
 */
export const analyzeCivicIssue = async (base64Data, mimeType = "image/jpeg") => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
  try {
    const response = await axios.post(`${backendUrl}/api/gemini-vision`, {
      base64Data,
      mimeType
    });
    return response.data;
  } catch (error) {
    console.error("Error proxying Gemini API request to backend:", error);
    throw error;
  }
};

/**
 * Drafts an escalation email using Gemini if an issue has been ignored.
 * @param {Object} issue - The issue details
 * @returns {Promise<string>} The email body text
 */
export const draftEscalationEmail = async (issue) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("YOUR_")) {
    throw new Error("Gemini API key is not configured.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Write a formal, firm, and professional escalation letter/email from an AI Citizen Advocate agent on behalf of the community.
  
  Details of the ignored issue:
  - Title: ${issue.title}
  - Category: ${issue.category}
  - Description: ${issue.description}
  - Location/Coordinates: Latitude ${issue.latitude}, Longitude ${issue.longitude}
  - Responsible Department: ${issue.department}
  - Date Reported: ${issue.createdAt}
  - Severity: ${issue.severity}/5
  - Days Ignored: 7+ days (Overdue)

  The email should be addressed to the Chief Municipal Officer / District Commissioner. It should state that the issue has been reported for over 7 days with no action, explain the community impact and safety risks, and demand urgent action. Keep it under 250 words. Do not include markdown formatting.`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await axios.post(url, payload);
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || "Failed to generate escalation draft.";
  } catch (error) {
    console.error("Error drafting escalation email:", error);
    return `Subject: URGENT Escalation: Unresolved ${issue.title} - ${issue.department}

Dear Chief Municipal Officer,

This is an automated escalation on behalf of the community regarding the reported issue: "${issue.title}".
This safety hazard has been flagged in our system for over 7 days with no resolution.

Please take immediate steps to address this.

Sincerely,
CivicAI Agent`;
  }
};

/**
 * Extracts structured civic issue details from a voice transcript using Gemini.
 */
export const extractIssueFromVoice = async (transcript) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("YOUR_")) {
    throw new Error("Gemini API Key is not configured.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const prompt = `Extract civic issue details from this voice report: '${transcript}'. Reply ONLY with a valid JSON object. Do not wrap in markdown code blocks. The JSON must match this schema:
  {
    "title": "Short descriptive title of the issue",
    "category": "One of: Pothole/Road Damage, Broken Streetlight/Electricity, Garbage/Sanitation, Water Leakage/Sewage, Public Facility Damage, Other",
    "description": "Elaborated description of the problem"
  }`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await axios.post(url, payload);
    let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error extracting details from voice:", error);
    let category = "Other";
    if (transcript.toLowerCase().includes("road") || transcript.toLowerCase().includes("pothole")) category = "Pothole/Road Damage";
    else if (transcript.toLowerCase().includes("light") || transcript.toLowerCase().includes("bulb") || transcript.toLowerCase().includes("electricity")) category = "Broken Streetlight/Electricity";
    else if (transcript.toLowerCase().includes("garbage") || transcript.toLowerCase().includes("trash") || transcript.toLowerCase().includes("waste")) category = "Garbage/Sanitation";
    else if (transcript.toLowerCase().includes("water") || transcript.toLowerCase().includes("leak") || transcript.toLowerCase().includes("sewage")) category = "Water Leakage/Sewage";
    return {
      title: "Voice-logged Issue",
      category,
      description: transcript
    };
  }
};

/**
 * Generates natural language summary for city health report.
 */
export const generateHealthReport = async (summaryText) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("YOUR_")) {
    throw new Error("Gemini API Key is not configured.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const prompt = `Generate a concise 2-sentence natural language summary analyzing the city's weekly health report. Emphasize active issues, resolution speeds, and escalated status: ${summaryText}. Keep it engaging, professional, and direct. Do not use markdown format.`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await axios.post(url, payload);
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || "City services are running normally with steady progress on reported tickets.";
  } catch (error) {
    console.error("Error generating health report:", error);
    return "City services are currently processing reported grievances. Keep reporting to improve community health.";
  }
};
