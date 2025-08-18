const fs = require('fs');
fs.mkdirSync('tmp', { recursive: true });

require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const twilio = require("twilio");
const translate = require('google-translate-api-x');

console.log('SERVER:', process.env.SERVER);

// Core services
const { GptService } = require('./automate-sales-call/pages/services/gpt-service');
const { StreamService } = require('./automate-sales-call/pages/services/stream-service');
const { TranscriptionService } = require('./automate-sales-call/pages/services/transcription-service');
const { TextToSpeechService } = require('./automate-sales-call/pages/services/tts-service');
const { recordingService } = require('./automate-sales-call/pages/services/recording-service');
const { makeOutBoundCall } = require('./automate-sales-call/pages/scripts/outbound-call'); // ✅ correct import

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Server is running!');
});

// ✅ Endpoint to start outbound call
app.post("/outbound-call", async (req, res) => {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    const call = await client.calls.create({
      url: "https://automate-sales-call-deploy-6zkcceh5g-bitlanceais-projects.vercel.app/voice", // this URL must return TwiML
      to: req.body.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// This is what Twilio fetches when the call connects
app.post("/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say("Hello, this is your automated call. Press any key to continue.");

  res.type("text/xml");
  res.send(twiml.toString());
});

//app.listen(3000, () => console.log("Server running on port 3000"));

// Twilio /incoming webhook
app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });
    response.pause({ length: 600 }); // 10 minutes
    res.type('text/xml').send(response.toString());
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Twilio WebSocket stream
app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    let streamSid, callSid;
    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService();

    const ttsQueue = [];
    let isTtsGenerating = false;
    let interactionCount = 0;
    let marks = [];

    async function processTtsQueue() {
      if (isTtsGenerating || ttsQueue.length === 0) return;
      isTtsGenerating = true;

      const { gptReply, icount } = ttsQueue.shift();
      try {
        console.log(`Interaction ${icount}: GPT -> TTS (Queued): ${gptReply.partialResponse}`.green);
        await ttsService.generate(gptReply, icount);
      } catch (err) {
        console.error('TTS generation failed:', err);
        isTtsGenerating = false;
        processTtsQueue();
      }
    }

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;

        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);

        setTimeout(() => {
          ttsQueue.push({
            gptReply: { partialResponseIndex: null, partialResponse: "लोधा बिल्डर्स में आपका स्वागत है, हम आपको हमारे एआई एजेंट से जोड़ रहे हैं।" },
            icount: 0,
          });

          ttsQueue.push({
            gptReply: { partialResponseIndex: null, partialResponse: "नमस्ते! क्या आप मुंबई या पुणे में नया घर खरीदने में रुचि रखते हैं?" },
            icount: 1,
          });

          processTtsQueue();
        }, 300);
      }

      if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      }

      if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter((m) => m !== label);
      }

      if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
      }
    });

    transcriptionService.on('utterance', async (text) => {
      if (marks.length > 0 && text?.length > 5) {
        console.log('Twilio -> Interruption, Clearing stream'.red);
        ws.send(JSON.stringify({ streamSid, event: 'clear' }));
      }
    });

    transcriptionService.on('transcription', async (text) => {
      if (!text) return;
      try {
        const { text: englishText } = await translate(text, { to: 'en' });
        console.log(`Interaction ${interactionCount} – STT(Hindi) -> EN -> GPT: ${englishText}`.yellow);
        gptService.completion(englishText, interactionCount++);
      } catch (err) {
        console.error('Translation error:', err);
      }
    });

    gptService.on('gptreply', async (gptReply, icount) => {
      try {
        const result = await translate(gptReply.partialResponse, { to: 'hi' });
        const hindiReply = { ...gptReply, partialResponse: result.text };
        console.log(`Interaction ${icount}: GPT -> Hindi -> TTS: ${hindiReply.partialResponse}`.green);
        ttsQueue.push({ gptReply: hindiReply, icount });
        processTtsQueue();
      } catch (err) {
        console.error('GPT->TTS translation failed:', err);
      }
    });

    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
      streamService.buffer(responseIndex, audio, label);

      const waitForMark = (markLabel) => {
        if (markLabel === label) {
          streamService.off('audiosent', waitForMark);
          isTtsGenerating = false;
          processTtsQueue();
        }
      };

      streamService.on('audiosent', waitForMark);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
