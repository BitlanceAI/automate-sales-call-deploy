import { makeOutBoundCall } from "../scripts/outbound-call"; // adjust path

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const callSid = await makeOutBoundCall(phoneNumber);
    res.status(200).json({ success: true, sid: callSid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}
