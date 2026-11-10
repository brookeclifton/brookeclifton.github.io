// Re-encodes a .glb's embedded textures as resized JPEGs so it's light enough for the web.
// Usage: node scripts/compress-glb.mjs input.glb output.glb [maxSize=4096] [quality=82]
// Uses macOS `sips` for image conversion.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [input, output, maxSize = '4096', quality = '82'] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/compress-glb.mjs input.glb output.glb [maxSize] [quality]');
  process.exit(1);
}

const glb = fs.readFileSync(input);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart);

const replaced = new Map(); // bufferView index -> new bytes
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glb-'));
(json.images ?? []).forEach((img, i) => {
  const view = json.bufferViews[img.bufferView];
  const src = path.join(tmp, `in${i}`);
  const dst = path.join(tmp, `out${i}.jpg`);
  fs.writeFileSync(src, bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  execFileSync('sips', ['-Z', maxSize, '-s', 'format', 'jpeg', '-s', 'formatOptions', quality, src, '--out', dst], { stdio: 'ignore' });
  replaced.set(img.bufferView, fs.readFileSync(dst));
  img.mimeType = 'image/jpeg';
});

// Rebuild the binary chunk with every bufferView 4-byte aligned
const parts = [];
let offset = 0;
json.bufferViews.forEach((view, i) => {
  const bytes = replaced.get(i) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  view.byteOffset = offset;
  view.byteLength = bytes.length;
  parts.push(bytes, Buffer.alloc(pad));
  offset += bytes.length + pad;
});
json.buffers[0].byteLength = offset;

let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const binBuf = Buffer.concat(parts);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
const chunk = (type, data) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(data.length, 0);
  h.writeUInt32LE(type, 4);
  return [h, data];
};
fs.writeFileSync(output, Buffer.concat([header, ...chunk(0x4e4f534a, jsonBuf), ...chunk(0x004e4942, binBuf)]));
console.log(`${input}: ${(glb.length / 1e6).toFixed(1)} MB -> ${output}: ${(fs.statSync(output).size / 1e6).toFixed(1)} MB`);
