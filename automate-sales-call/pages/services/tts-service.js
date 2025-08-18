const EventEmitter = require('events');
const fs = require('fs');
const googleTTS = require('../functions/googleTTS');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.speechCount = 0;
  }

  async generate(gptReply, interactionCount) {
    try {
      const responseIndex = gptReply.partialResponseIndex ?? this.speechCount++;
      const text = gptReply.partialResponse;
      console.log(`[TTSService] Generating speech for: "${text}" (index: ${responseIndex})`);
      if (!text) return;

      const label = `speech-${Date.now()}-${responseIndex}`;
      const filePath = await googleTTS({ text });

      const audio = fs.readFileSync(filePath); // Already raw .ulaw audio

      // Emit the audio buffer with the correct label so it can be passed to streamService.buffer()
      this.emit('speech', responseIndex, audio, label, interactionCount);

      console.log(`[TTSService] Emitted speech for index: ${responseIndex}, label: ${label}`);
    } catch (err) {
      console.error('Google TTS failed:', err);
    }
  }
}

module.exports = { TextToSpeechService };