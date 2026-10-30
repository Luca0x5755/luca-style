// Penpot 匯出檔測試共用工具：即時組出 zip，不提交真實匯出檔。
import { crc32, deflateRawSync } from 'node:zlib';

// 組一個 zip：entries 為 路徑 -> 內容（物件會轉 JSON，Buffer 原樣）；deflate 為 true 時用壓縮方式 8。
export function zip(entries, { deflate = false, dosTime = 0, dosDate = 0 } = {}) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
    const comp = deflate ? deflateRawSync(data) : data;
    const method = deflate ? 8 : 0;
    const nameBuf = Buffer.from(name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(method, 8);
    head.writeUInt16LE(dosTime, 10);
    head.writeUInt16LE(dosDate, 12);
    head.writeUInt32LE(crc32(data), 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc32(data), 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(head, nameBuf, comp);
    central.push(cen, nameBuf);
    offset += head.length + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}


// 唯一允許被追蹤的 Penpot 匯出檔（ISSUE-027）；其餘一律不准進 repo。
export const LIBRARY_EXPORT = 'docs/mockup/luca-style-library.penpot';

// 守門：回傳違規描述清單。files 為相對 repo 根的路徑（正斜線），headOf(path) 回傳前 4 位元組（檔案不存在時回傳 null）。
export function exportViolations(files, headOf) {
  const bad = [];
  for (const f of files) {
    if (f === LIBRARY_EXPORT) continue;
    if (f.toLowerCase().endsWith('.penpot')) {
      bad.push(`被追蹤或待追蹤的匯出檔 ${f}`);
      continue;
    }
    if (f.endsWith('.fig')) continue; // OpenPencil 的 .fig 本身是 zip，由 ISSUE-029 退役；這裡只擋 Penpot 匯出檔偽裝成其他副檔名
    const head = headOf(f);
    if (head && head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) bad.push(`${f} 以 zip 魔術位元組開頭`);
  }
  return bad;
}
