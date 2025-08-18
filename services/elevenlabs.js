// services/elevenlabs.js
const fetch = require('node-fetch');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY; // put this in your .env

const VOICE_ID = 'your_voice_id_here'; // Example: 'pNInz6obpgDQGcFmaJgB'

async function speak(text, ws) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.replace(/•/g, ', '), // convert pause markers to commas for more natural speech
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.6,
      },
    }),
  });

  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = value.toString('base64');
    const message = {
      event: 'media',
      media: {
        payload: chunk,
      },
    };

    ws.send(JSON.stringify(message));
    await new Promise(r => setTimeout(r, 20)); // send chunks every 20ms
  }
}

module.exports = speak;