// ISSUE-020 試點、ISSUE-023 正式化。
// 最小的 zip 讀取器，只在記憶體內解開，不寫入磁碟，所以不受條目路徑影響；
// 匯出檔是不受信任的資料，因此拒絕加密、zip64、可疑路徑，並限制條目數與解壓後大小。
import { inflateRawSync } from 'node:zlib';

const MAX_ENTRIES = 5000;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

// 回傳 Map<條目名稱, Buffer>；格式不合就丟出帶原因的 Error。
export function readZip(buf) {
  const eocd = findEocd(buf);
  const total = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  if (total > MAX_ENTRIES) throw new Error(`zip 條目數 ${total} 超過上限 ${MAX_ENTRIES}`);
  if (total === 0xffff || pos === 0xffffffff) throw new Error('不支援 zip64');

  const entries = new Map();
  let totalBytes = 0;
  for (let i = 0; i < total; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('zip 中央目錄損毀');
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const size = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue; // 目錄條目
    if (flags & 1) throw new Error(`zip 條目 ${name} 已加密`);
    if (name.startsWith('/') || name.split('/').includes('..') || name.includes('\\')) throw new Error(`zip 條目路徑可疑：${name}`);
    if (entries.has(name)) throw new Error(`zip 有重複條目：${name}`);
    if (size > MAX_ENTRY_BYTES) throw new Error(`zip 條目 ${name} 解壓後 ${size} bytes 超過上限`);
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`zip 條目 ${name} 的本地標頭損毀`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (start + compSize > buf.length) throw new Error(`zip 條目 ${name} 超出檔案範圍`);
    const raw = buf.subarray(start, start + compSize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) {
      try {
        data = inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
      } catch (e) {
        throw new Error(`zip 條目 ${name} 無法解壓：${e.message}`);
      }
    }
    else throw new Error(`zip 條目 ${name} 使用不支援的壓縮方式 ${method}`);
    if (data.length !== size) throw new Error(`zip 條目 ${name} 解壓後大小與標頭不符`);
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error(`zip 解壓後總大小超過上限 ${MAX_TOTAL_BYTES} bytes`);
    entries.set(name, data);
  }
  return entries;
}

function findEocd(buf) {
  const from = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('不是 zip 檔（找不到結尾記錄）');
}
