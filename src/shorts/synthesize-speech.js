const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// Uses Microsoft Edge's free, keyless "Read Aloud" text-to-speech service.
// This is a real network call to a Microsoft-operated endpoint -- not
// literally offline -- but it requires no account, no API key, and no
// payment. See CLAUDE.md for the exact constraint this satisfies.
async function synthesizeSpeech({ text, voiceId, outputDir }) {
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(outputDir, text);
    return audioFilePath;
  } finally {
    tts.close();
  }
}

module.exports = { synthesizeSpeech };
