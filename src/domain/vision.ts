import { COLORS, COLOR_KEYS, type Color, type CubeSize } from './cube';
import { quarterTurns, rotateGrid } from './orientation';

export type Point = { x: number; y: number };
export type RGB = [number, number, number];
export type Sample = { rgb: RGB; color: Color; confidence: number };
export type Photo = { url: string; corners: Point[]; samples: Sample[] };
export const DEFAULT_CORNERS: Point[] = [{ x: .08, y: .08 }, { x: .92, y: .08 }, { x: .92, y: .92 }, { x: .08, y: .92 }];
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
export async function importPhoto(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('照片超过 20 MB，请压缩后再试');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.width * image.height > 50_000_000) throw new Error('照片分辨率过高，请选择较小的照片');
    const ratio = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .88);
  } catch (error) {
    if (error instanceof Error && error.message.includes('分辨率')) throw error;
    throw new Error('无法读取这张照片，请使用 JPEG、PNG 或 WebP；HEIC 请先转换');
  } finally { URL.revokeObjectURL(url); }
}
export async function transformPhoto(url: string, mirror: boolean, turns = 1): Promise<string> {
  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  const swap = !mirror && quarterTurns(turns) % 2 === 1;
  canvas.width = swap ? image.height : image.width;
  canvas.height = swap ? image.width : image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (mirror) ctx.scale(-1, 1); else ctx.rotate(quarterTurns(turns) * Math.PI / 2);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas.toDataURL('image/png');
}

export function transformPhotoGeometry(photo: Pick<Photo, 'corners' | 'samples'>, mirror: boolean, turns = 1) {
  let corners = photo.corners.map(p => ({ ...p }));
  let samples = [...photo.samples];
  if (mirror) {
    corners = [1, 0, 3, 2].map(i => ({ x: 1 - corners[i].x, y: corners[i].y }));
    if (samples.length) {
      const size = Math.sqrt(samples.length);
      if (size !== 3 && size !== 4) throw new Error('照片应有 9 或 16 个取样');
      samples = samples.map((_, i) => samples[Math.floor(i / size) * size + size - 1 - i % size]);
    }
  } else {
    for (let i = 0; i < quarterTurns(turns); i++) {
      corners = [3, 0, 1, 2].map(index => ({ x: 1 - corners[index].y, y: corners[index].x }));
    }
    if (samples.length) samples = rotateGrid(samples, turns);
  }
  return { corners, samples };
}

export async function transformCapturedPhoto(photo: Photo, mirror: boolean, turns = 1): Promise<Photo> {
  return { url: await transformPhoto(photo.url, mirror, turns), ...transformPhotoGeometry(photo, mirror, turns) };
}

// 四点透视变换；输入顺序为左上、右上、右下、左下。
export function homography(points: Point[]): (u: number, v: number) => Point {
  if (points.length !== 4) throw new Error('请标出魔方面的四个角');
  const crosses = points.map((p, i) => {
    const b = points[(i + 1) % 4], c = points[(i + 2) % 4];
    return (b.x - p.x) * (c.y - b.y) - (b.y - p.y) * (c.x - b.x);
  });
  if (crosses.some(c => c < .003)) throw new Error('四角不能交叉或太靠近，请按左上、右上、右下、左下排列');
  const source = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const matrix: number[][] = [];
  source.forEach(([u, v], i) => {
    const { x, y } = points[i];
    matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const div = matrix[col][col];
    if (Math.abs(div) < 1e-10) throw new Error('取景范围过小，请重新调整四个角');
    for (let j = col; j < 9; j++) matrix[col][j] /= div;
    for (let row = 0; row < 8; row++) if (row !== col) {
      const factor = matrix[row][col];
      for (let j = col; j < 9; j++) matrix[row][j] -= factor * matrix[col][j];
    }
  }
  const h = matrix.map(row => row[8]);
  return (u, v) => {
    const d = h[6] * u + h[7] * v + 1;
    return { x: (h[0] * u + h[1] * v + h[2]) / d, y: (h[3] * u + h[4] * v + h[5]) / d };
  };
}
export function rgbToLab(rgb: RGB): RGB {
  const [r, g, b] = rgb.map(c => c / 255).map(c => c > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92);
  const xyz = [(r * .4124564 + g * .3575761 + b * .1804375) / .95047, r * .2126729 + g * .7151522 + b * .072175, (r * .0193339 + g * .119192 + b * .9503041) / 1.08883];
  const [x, y, z] = xyz.map(c => c > .008856 ? Math.cbrt(c) : 7.787 * c + 16 / 116);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const defaultPalette = Object.fromEntries(COLOR_KEYS.map(c => [c, [1, 3, 5].map(i => parseInt(COLORS[c].hex.slice(i, i + 2), 16))])) as Record<Color, RGB>;
export function classify(rgb: RGB, palette = defaultPalette): Sample {
  const lab = rgbToLab(rgb);
  const ranked = COLOR_KEYS.map(color => {
    const reference = rgbToLab(palette[color]);
    // 明度差异降低权重，仍保留对白色/黄色区分所需的色度。
    const distance = Math.hypot((lab[0] - reference[0]) * .5, lab[1] - reference[1], lab[2] - reference[2]);
    return { color, distance };
  }).sort((a, b) => a.distance - b.distance);
  const confidence = Math.max(0, Math.min(1, (ranked[1].distance - ranked[0].distance) / Math.max(1, ranked[1].distance)));
  return { rgb, color: ranked[0].color, confidence };
}
export async function samplePhoto(url: string, corners: Point[], size: CubeSize = 3): Promise<Sample[]> {
  const project = homography(corners);
  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return Array.from({ length: size * size }, (_, index) => {
    const channels: number[][] = [[], [], []];
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const point = project((index % size + .5 + x * .07) / size, (Math.floor(index / size) + .5 + y * .07) / size);
      const px = Math.max(0, Math.min(width - 1, Math.round(point.x * width)));
      const py = Math.max(0, Math.min(height - 1, Math.round(point.y * height)));
      const offset = (py * width + px) * 4;
      channels.forEach((channel, i) => channel.push(data[offset + i]));
    }
    const rgb = channels.map(channel => channel.sort((a, b) => a - b)[12]) as RGB;
    return classify(rgb);
  });
}
