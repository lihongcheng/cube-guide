import { validateFourState } from './four';

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];
export type Vec = [number, number, number];
export type CubeSize = 3 | 4;
export type Move = { face: Face; turns: 1 | -1 | 2; width?: 1 | 2 };
export type Color = 'w' | 'r' | 'g' | 'y' | 'o' | 'b';
export const COLORS: Record<Color, { name: string; hex: string }> = {
  w: { name: '白色', hex: '#f4f5ef' },
  r: { name: '红色', hex: '#ed5258' },
  g: { name: '绿色', hex: '#28b982' },
  y: { name: '黄色', hex: '#f7cd4b' },
  o: { name: '橙色', hex: '#ff913e' },
  b: { name: '蓝色', hex: '#4485ed' },
};
export const COLOR_KEYS = Object.keys(COLORS) as Color[];
export const DEFAULT_SCHEME: Record<Face, Color> = { U: 'w', R: 'r', F: 'g', D: 'y', L: 'o', B: 'b' };
export const FACE_NAMES: Record<Face, string> = { U: '上面', R: '右面', F: '前面', D: '下面', L: '左面', B: '后面' };
export const CAPTURE_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];
export const NEIGHBORS: Record<Face, [Face, Face, Face, Face]> = {
  U: ['B', 'R', 'F', 'L'], R: ['U', 'B', 'D', 'F'], F: ['U', 'R', 'D', 'L'],
  D: ['F', 'R', 'B', 'L'], L: ['U', 'F', 'D', 'B'], B: ['U', 'L', 'D', 'R'],
};
export const AXES: Record<Face, { axis: 0 | 1 | 2; sign: 1 | -1 }> = {
  U: { axis: 1, sign: 1 }, R: { axis: 0, sign: 1 }, F: { axis: 2, sign: 1 },
  D: { axis: 1, sign: -1 }, L: { axis: 0, sign: -1 }, B: { axis: 2, sign: -1 },
};
export const solvedState = (size: CubeSize = 3) => FACES.map(f => f.repeat(size * size)).join('');
export function sizeOf(state: string | readonly unknown[]): CubeSize {
  if (state.length === 54) return 3;
  if (state.length === 96) return 4;
  throw new Error('魔方应有 54 或 96 个格子');
}
export const SOLVED = solvedState();
export const DEMO_SCRAMBLE = "R U R' F2 D L2 B U' R2 F";

function makeFacelets(size: CubeSize) {
  const extent = (size - 1) / 2;
  return FACES.flatMap((face, fi) =>
  Array.from({ length: size * size }, (_, cell) => {
    const r = Math.floor(cell / size), c = cell % size;
    const positions: Record<Face, Vec> = {
      U: [c - extent, extent, r - extent], R: [extent, extent - r, extent - c], F: [c - extent, extent - r, extent],
      D: [c - extent, -extent, extent - r], L: [-extent, extent - r, c - extent], B: [extent - c, extent - r, -extent],
    };
    const normal: Vec = [0, 0, 0];
    normal[AXES[face].axis] = AXES[face].sign;
    return { face, index: fi * size * size + cell, cell, position: positions[face], normal };
  }),
  );
}
const faceletsBySize = { 3: makeFacelets(3), 4: makeFacelets(4) };
export const getFacelets = (size: CubeSize) => faceletsBySize[size];
export const FACELETS = getFacelets(3);
const vectorKey = (p: Vec, n: Vec) => [...p, ...n].join(',');
const lookups = {
  3: new Map(getFacelets(3).map(f => [vectorKey(f.position, f.normal), f.index])),
  4: new Map(getFacelets(4).map(f => [vectorKey(f.position, f.normal), f.index])),
};
export function inLayer(position: Vec, move: Move, size: CubeSize) {
  const { axis, sign } = AXES[move.face];
  return sign * position[axis] >= (size - 1) / 2 - ((move.width ?? 1) - 1);
}
export function getBlocks(size: CubeSize) {
  const extent = (size - 1) / 2;
  return Array.from({ length: size ** 3 }, (_, i) =>
    [i % size - extent, Math.floor(i / size) % size - extent, Math.floor(i / (size * size)) - extent] as Vec)
    .filter(p => p.some(v => Math.abs(v) === extent))
    .map(position => ({ position, facelets: getFacelets(size).filter(f => f.position.every((v, j) => v === position[j])) }));
}
function rotate(v: Vec, axis: number, direction: number): Vec {
  const [x, y, z] = v;
  return axis === 0 ? [x, -direction * z, direction * y]
    : axis === 1 ? [direction * z, y, -direction * x]
      : [-direction * y, direction * x, z];
}
export function applyMove(state: string, move: Move): string {
  const size = sizeOf(state);
  if (!FACES.includes(move.face) || ![1, -1, 2].includes(move.turns) ||
    (move.width !== undefined && move.width !== 1 && move.width !== 2) || (size === 3 && move.width === 2)) throw new Error('不支持这个转动');
  if (move.turns === 2) return applyMove(applyMove(state, { ...move, turns: 1 }), { ...move, turns: 1 });
  const { axis, sign } = AXES[move.face];
  const result = state.split('');
  for (const f of getFacelets(size)) {
    if (!inLayer(f.position, move, size)) continue;
    const p = rotate(f.position, axis, -sign * move.turns);
    const n = rotate(f.normal, axis, -sign * move.turns);
    result[lookups[size].get(vectorKey(p, n))!] = state[f.index];
  }
  return result.join('');
}
export function parseMoves(algorithm: string): Move[] {
  if (!algorithm.trim()) return [];
  return algorithm.trim().split(/\s+/).map(token => {
    if (!/^[URFDLB]w?(2|')?$/.test(token)) throw new Error(`无法识别动作：${token}`);
    return { face: token[0] as Face, turns: token.endsWith('2') ? 2 : token.endsWith("'") ? -1 : 1, ...(token.includes('w') ? { width: 2 as const } : {}) };
  });
}
export const applyMoves = (state: string, moves: Move[]) => moves.reduce(applyMove, state);
export const atomicMoves = (moves: Move[]): Move[] => moves.flatMap(m => m.turns === 2 ? [{ ...m, turns: 1 }, { ...m, turns: 1 }] : [m]);
export const inverseMove = (m: Move): Move => ({ ...m, turns: m.turns === 2 ? 2 : m.turns === 1 ? -1 : 1 });
export const moveToken = (m: Move) => m.face + (m.width === 2 ? 'w' : '') + (m.turns === 2 ? '2' : m.turns === -1 ? "'" : '');
export const DEMO_STATE = applyMoves(SOLVED, parseMoves(DEMO_SCRAMBLE));
export const FOUR_DEMO_STATE = applyMoves(solvedState(4), parseMoves("Rw U F2 Uw' R Fw D2 Lw' B U2"));
export const demoState = (size: CubeSize) => size === 4 ? FOUR_DEMO_STATE : DEMO_STATE;
export const toColors = (state: string, scheme = DEFAULT_SCHEME): Color[] => [...state].map(f => scheme[f as Face]);
export function normalizeColors(colors: Color[], targetScheme = DEFAULT_SCHEME): { state: string; scheme: Record<Face, Color> } {
  if (![54, 96].includes(colors.length) || colors.some(c => !COLOR_KEYS.includes(c))) throw new Error('请完成六个面的颜色录入');
  if (colors.length === 96) {
    if (FACES.some(f => !COLOR_KEYS.includes(targetScheme[f])) || new Set(FACES.map(f => targetScheme[f])).size !== 6) throw new Error('还原后的六面配色不能重复');
    return { state: colors.map(c => FACES.find(f => targetScheme[f] === c)!).join(''), scheme: { ...targetScheme } };
  }
  const centers = FACES.map((_, i) => colors[i * 9 + 4]);
  if (new Set(centers).size !== 6) throw new Error('六个中心块的颜色不能重复，请检查各面中间的格子');
  const scheme = Object.fromEntries(FACES.map((f, i) => [f, centers[i]])) as Record<Face, Color>;
  const state = colors.map(c => FACES[centers.indexOf(c)]).join('');
  return { state, scheme };
}

// 标准 URFDLB 面片编码，按每个角块的有向顺序记录，不能仅比较颜色集合。
const CORNERS = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const EDGES = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
const cornerColors = CORNERS.map(indices => indices.map(i => SOLVED[i]));
const edgeColors = EDGES.map(indices => indices.map(i => SOLVED[i]));
const parity = (p: number[]) => p.reduce((total, v, i) => total + p.slice(i + 1).filter(w => w < v).length, 0) % 2;
export function validateState(state: string): string[] {
  if (state.length === 96) return validateFourState(state);
  if (state.length !== 54 || /[^URFDLB]/.test(state)) return ['请完整录入六面，共 54 个格子'];
  const errors: string[] = [];
  for (const f of FACES) {
    const count = [...state].filter(c => c === f).length;
    if (count !== 9) errors.push(`${FACE_NAMES[f]}中心对应的颜色有 ${count} 格，应为 9 格`);
  }
  if (FACES.some((f, i) => state[i * 9 + 4] !== f)) errors.push('中心块映射不正确，请重新确认六面');
  if (errors.length) return errors;
  const cp: number[] = [], co: number[] = [], ep: number[] = [], eo: number[] = [];
  for (const indices of CORNERS) {
    const cs = indices.map(i => state[i]);
    const orientation = cs.findIndex(c => c === 'U' || c === 'D');
    const piece = cornerColors.findIndex(expected => expected.every((c, j) => c === cs[(orientation + j) % 3]));
    if (orientation === -1 || piece === -1) return ['角块颜色组合或方向不正确，请核对照片方向和角落的格子'];
    cp.push(piece); co.push(orientation);
  }
  for (const indices of EDGES) {
    const cs = indices.map(i => state[i]);
    let piece = edgeColors.findIndex(e => e[0] === cs[0] && e[1] === cs[1]);
    let orientation = 0;
    if (piece === -1) {
      piece = edgeColors.findIndex(e => e[0] === cs[1] && e[1] === cs[0]);
      orientation = 1;
    }
    if (piece === -1) return ['棱块颜色组合不正确，请检查每面边缘中间的格子'];
    ep.push(piece); eo.push(orientation);
  }
  if (new Set(cp).size !== 8 || new Set(ep).size !== 12) errors.push('出现重复或缺失的块，请检查六面照片是否拍重或颜色识别有误');
  if (co.reduce((a, b) => a + b, 0) % 3) errors.push('角块朝向不一致，请检查角落颜色或照片方向');
  if (eo.reduce((a, b) => a + b, 0) % 2) errors.push('棱块朝向不一致，请检查边缘颜色或照片方向');
  if (parity(cp) !== parity(ep)) errors.push('角块与棱块的排列不匹配，请重新核对六面');
  return errors;
}

export function describeMove(move: Move) {
  const positive: Record<Face, string> = {
    R: '靠近你的这一竖排，向上转', L: '靠近你的这一竖排，向下转',
    U: '靠近你的这一横排，向左转', D: '靠近你的这一横排，向右转',
    F: '正对前面看，顺时针转', B: '正对后面看，顺时针转',
  };
  const negative: Record<Face, string> = {
    R: '靠近你的这一竖排，向下转', L: '靠近你的这一竖排，向上转',
    U: '靠近你的这一横排，向右转', D: '靠近你的这一横排，向左转',
    F: '正对前面看，逆时针转', B: '正对后面看，逆时针转',
  };
  return {
    title: `转动${FACE_NAMES[move.face].replace('面', '侧')}${move.width === 2 ? '相邻的两层' : '这一层'}`,
    detail: move.width === 2
      ? (move.turns === -1 ? negative : positive)[move.face].replace('这一竖排', '这两竖排一起').replace('这一横排', '这两横排一起').replace('看，', '看，两层一起')
      : (move.turns === -1 ? negative : positive)[move.face],
    angle: move.turns === 2 ? '半圈 · 180°' : '一格 · 90°',
  };
}
