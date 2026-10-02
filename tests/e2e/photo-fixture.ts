import { deflateSync } from 'node:zlib';
import { COLORS, DEFAULT_SCHEME, FACES, sizeOf, type Face } from '../../src/domain/cube';

// 自建 PNG 编码器，仅用于生成已知状态的合成照片测试输入。
function crc32(data: Buffer) {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function chunk(name: string, data: Buffer) {
  const kind = Buffer.from(name);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([size, kind, data, crc]);
}
export function facePhoto(state: string, face: Face): Buffer {
  const size = 360;
  const order = sizeOf(state), unit = size / order;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const offset = FACES.indexOf(face) * order * order;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = COLORS[DEFAULT_SCHEME[state[offset + Math.floor(y / unit) * order + Math.floor(x / unit)] as Face]].hex;
      const gap = x % unit < 6 || x % unit > unit - 7 || y % unit < 6 || y % unit > unit - 7;
      for (let c = 0; c < 3; c++) raw[y * (size * 3 + 1) + 1 + x * 3 + c] = gap ? 30 : parseInt(color.slice(c * 2 + 1, c * 2 + 3), 16);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
