const EventEmitter = require('events');
const uuid = require('uuid');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
  }

  // services/stream-service.js
  buffer(responseIndex, audioBuffer, label) {
    console.log(`[StreamService] Buffering audio index: ${responseIndex}, size: ${audioBuffer.length}`);
    this.sendAudio(audioBuffer, label);
  }

  sendAudio(audio, label) {
    const rawAudio = audio;
    const chunkSize = 320;
    let offset = 0;
    const markLabel = label; // use provided label directly
    console.log(`[StreamService] Sending audio for label: ${markLabel}, total length: ${rawAudio.length}`);

    const sendChunk = () => {
      if (offset >= rawAudio.length) {
        console.log(`[StreamService] Completed sending audio for ${markLabel}`);
        this.ws.send(JSON.stringify({
          streamSid: this.streamSid,
          event: 'mark',
          mark: { name: markLabel }
        }));
        setTimeout(() => {
          this.emit('audiosent', markLabel);
        }, 300); // small buffer
        return;
      }

      const chunk = rawAudio.slice(offset, offset + chunkSize);
      offset += chunkSize;

      this.ws.send(JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: { payload: chunk.toString('base64') }
      }));

      setTimeout(sendChunk, 20);
    };

    sendChunk();
  }
}

module.exports = { StreamService };