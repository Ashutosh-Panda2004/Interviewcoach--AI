import { Blob } from '@google/genai';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  // Process in chunks to prevent stack overflow with String.fromCharCode.apply
  // and avoid massive string concatenation loops that cause GC pauses.
  const chunkSize = 0x8000; // 32KB chunks
  
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    // @ts-ignore - compiled code handles Uint8Array in apply fine in modern browsers
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  
  // Linear interpolation for smoother downsampling
  for (let i = 0; i < newLength; i++) {
    const inputIndex = i * ratio;
    const index = Math.floor(inputIndex);
    const decimal = inputIndex - index;
    const p1 = input[index] || 0;
    const p2 = input[index + 1] || p1;
    result[i] = p1 + decimal * (p2 - p1);
  }
  return result;
}

export function createPCM16Blob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] before converting to Int16 to avoid clipping noise
    const clamped = Math.max(-1, Math.min(1, data[i]));
    int16[i] = clamped * 32768;
  }
  return {
    data: uint8ArrayToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}