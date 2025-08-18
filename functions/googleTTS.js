const fs = require('fs');
const path = require('path');
const util = require('util');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

let credentials;

if (process.env.GOOGLE_TTS_CRED_JSON) {
  try {
    credentials = JSON.parse(process.env.GOOGLE_TTS_CRED_JSON);
  } catch (err) {
    console.error('❌ GOOGLE_TTS_CRED_JSON is malformed:', err);
    process.exit(1);
  }
} else {
  const credPath = path.join(__dirname, './google_tts_credentials.json');
  if (fs.existsSync(credPath)) {
    credentials = require(credPath);
  } else {
    console.error('❌ No Google TTS credentials found (env or local)');
    process.exit(1);
  }
}

const client = new TextToSpeechClient({ credentials });

const writeFile = util.promisify(fs.writeFile);

async function googleTTS({ text }) {
  const request = {
    input: { text },
    voice: {
      languageCode: 'hi-IN',
      name: 'hi-IN-Wavenet-C',
    },
    audioConfig: {
      audioEncoding: 'MULAW',
      sampleRateHertz: 8000,
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  const filename = `speech-${Date.now()}.ulaw`;
  const filepath = path.join(__dirname, '../tmp', filename);

  await writeFile(filepath, response.audioContent, 'binary');
  return filepath;
}

module.exports = googleTTS;
