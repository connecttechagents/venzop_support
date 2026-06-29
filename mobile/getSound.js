const fs = require('fs');

const sampleRate = 44100;
const duration = 0.15; // 150ms beep
const frequency = 880; // A5 beep
const numSamples = Math.floor(sampleRate * duration);

// WAV file header
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + numSamples * 2, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM
header.writeUInt16LE(1, 20); // Linear PCM
header.writeUInt16LE(1, 22); // Mono
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
header.writeUInt16LE(2, 32); // Block align
header.writeUInt16LE(16, 34); // Bits per sample
header.write('data', 36);
header.writeUInt32LE(numSamples * 2, 40);

const data = Buffer.alloc(numSamples * 2);

for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Envelope for a softer beep
    const envelope = Math.exp(-t * 20);
    const value = Math.sin(t * frequency * 2 * Math.PI) * 16000 * envelope;
    data.writeInt16LE(Math.floor(value), i * 2);
}

fs.writeFileSync('assets/beep.wav', Buffer.concat([header, data]));
console.log("Created beep.wav successfully.");
