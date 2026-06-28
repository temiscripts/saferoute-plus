/**
 * Convert any audio Blob (webm, mp4, ogg) to a 16-bit PCM WAV Blob
 * using the Web Audio API. This lets the Python voice model read it
 * with librosa/soundfile without needing ffmpeg on the server.
 */
export async function blobToWav(blob: Blob, targetSampleRate = 22050): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext({ sampleRate: targetSampleRate });
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const wav = encodeWav(audioBuffer);
    return new Blob([wav], { type: 'audio/wav' });
  } finally {
    await ctx.close();
  }
}

function encodeWav(buf: AudioBuffer): ArrayBuffer {
  const numSamples = buf.length;
  const sampleRate = buf.sampleRate;
  const output = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(output);

  function str(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }

  // RIFF header
  str(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  str(8, 'WAVE');

  // fmt chunk
  str(12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample

  // data chunk
  str(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Mix down to mono (average all channels)
  const numChannels = buf.numberOfChannels;
  const channels = Array.from({ length: numChannels }, (_, i) => buf.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i];
    const s = Math.max(-1, Math.min(1, sum / numChannels));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return output;
}
