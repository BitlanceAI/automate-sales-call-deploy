import { makeOutBoundCall } from "@/twilioService";

const allowedOrigins = [
  "http://localhost:3000",
  "https://automate-sales-call-frontend-git-main-bitlanceais-projects.vercel.app"
];

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // Set CORS headers
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*"); // fallback
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number required" });
    }

    const callSid = await makeOutBoundCall(phoneNumber);
    return res.status(200).json({ success: true, sid: callSid });
  } catch (err) {
    console.error("Twilio call error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
