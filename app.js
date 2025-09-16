import 'dotenv/config';   // <-- this must be line 1
import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import WebSocket from "ws";
import { synthesizeSpeech } from "./services/tts-service.js";
import translate from "google-translate-api-x";

dotenv.config({ path: "./.env" });

const app = express();
expressWs(app);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

let twilioWs = null;
let deepgramWs = null;

// TTS Queue
const ttsQueue = [];
let isTtsPlaying = false;

// ========== Twilio Incoming ========== //
app.post("/incoming", (req, res) => {
  console.log("Incoming call from:", req.body.From);
  const twiml = `<Response><Connect><Stream url="wss://${req.headers.host}/media" /></Connect></Response>`;
  res.type("text/xml").send(twiml);
});

// ========== Media WS ========== //
app.ws("/media", (ws) => {
  console.log("🔌 Twilio Media WS connected");
  twilioWs = ws;
  connectToDeepgram();

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.event === "media" && deepgramWs?.readyState === WebSocket.OPEN) {
      deepgramWs.send(Buffer.from(data.media.payload, "base64"));
    }
  });

  ws.on("close", () => {
    console.log("❌ Twilio WS closed");
    deepgramWs?.close();
  });
});

// ========== Deepgram Realtime STT ========== //
function connectToDeepgram() {
  console.log("🔗 Connecting to Deepgram STT...");
  deepgramWs = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=mulaw&sample_rate=8000",
    { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } }
  );

  deepgramWs.on("open", () => console.log("✅ Connected to Deepgram STT"));

  deepgramWs.on("message", async (msg) => {
    const data = JSON.parse(msg);
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript || transcript.length === 0) return;

    console.log("User said:", transcript);
    const { text: englishText } = await translate(transcript, { to: "en" });
    const botReply = generateBotReply(englishText);
    const { text: hindiReply } = await translate(botReply, { to: "hi" });

    ttsQueue.push(hindiReply);
    playTtsQueue();
  });
}

// ========== Bot Logic ========== //
function generateBotReply(text) {
  text = text.toLowerCase();
  if (text.includes("price")) return "The starting price is 50 lakh rupees.";
  if (text.includes("hello")) return "Hello! How are you doing today?";
  return "I am your sales assistant. Could you tell me what you are looking for?";
}

// ========== TTS Queue Player ========== //
async function playTtsQueue() {
  if (isTtsPlaying || ttsQueue.length === 0) return;
  isTtsPlaying = true;

  const text = ttsQueue.shift();
  try {
    const audioBuffer = await synthesizeSpeech(text);

    if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN) return;

    const chunkSize = 320;
    let offset = 0;
    while (offset < audioBuffer.length) {
      const chunk = audioBuffer.slice(offset, offset + chunkSize);
      offset += chunkSize;

      twilioWs.send(
        JSON.stringify({ event: "media", media: { payload: chunk.toString("base64") } })
      );
      await new Promise((r) => setTimeout(r, 20));
    }

    twilioWs.send(JSON.stringify({ event: "mark", mark: { name: "tts-end" } }));
  } catch (err) {
    console.error("TTS failed:", err);
  } finally {
    isTtsPlaying = false;
    playTtsQueue();
  }
}

// ========== Start Server ========== //
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
