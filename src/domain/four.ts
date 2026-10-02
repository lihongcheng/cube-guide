import topology from '../vendor/four-solver/topology.json' with { type: 'json' };
import type { State444 } from '../vendor/four-solver/engine';

const solved = ['U', 'R', 'F', 'D', 'L', 'B'].map(f => f.repeat(16)).join('');
const cornerColors = topology.corners.map(ids => ids.map(i => solved[i]));
const wingColors = topology.wings.map(ids => ids.map(i => solved[i]).join(''));

// Wings have a fixed handed order: the two wings of a colour pair are distinct.
// Do not sort their colours, or apply the 3x3 edge-flip/parity constraints.
export function decodeFour(state: string): State444 {
  if (state.length !== 96 || /[^URFDLB]/.test(state)) throw new Error('请完整录入六面，共 96 个格子');
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    const count = [...state].filter(c => c === face).length;
    if (count !== 16) throw new Error(`每种颜色应为 16 格，请检查颜色数量（当前有 ${count} 格）`);
  }
  const cornerPermutation: number[] = [], cornerOrientation: number[] = [];
  for (const ids of topology.corners) {
    const colors = ids.map(i => state[i]);
    let piece = -1, orientation = -1;
    for (let twist = 0; twist < 3; twist++) {
      const found = cornerColors.findIndex(expected => expected.every((c, j) => c === colors[(j + twist) % 3]));
      if (found !== -1) { piece = found; orientation = twist; break; }
    }
    if (piece === -1) throw new Error('角块颜色组合或方向不正确，请检查角落、照片方向和还原后的配色');
    cornerPermutation.push(piece); cornerOrientation.push(orientation);
  }
  if (new Set(cornerPermutation).size !== 8) throw new Error('角块重复或缺失，请核对六面照片与角落颜色');
  if (cornerOrientation.reduce((a, b) => a + b, 0) % 3) throw new Error('角块朝向不一致，请检查角落颜色或照片方向');
  const wingPermutation = topology.wings.map(ids => wingColors.indexOf(ids.map(i => state[i]).join('')));
  if (wingPermutation.includes(-1)) throw new Error('棱块颜色组合不正确，请检查每条边上的两个格子和还原后的配色');
  if (new Set(wingPermutation).size !== 24) throw new Error('出现重复或翻转的单个小棱块，请核对边缘颜色和照片方向');
  const centreColour = topology.centres.map(i => topology.faces.indexOf(state[i]));
  if (topology.faces.some((_, f) => centreColour.filter(c => c === f).length !== 4)) throw new Error('每种颜色应有 4 个中心格，请核对每面中间的四格');
  // Equal-colour centres are indistinguishable; they can always supply the
  // required centre/corner parity. Wing permutation is independently free.
  return { cornerPermutation, cornerOrientation, wingPermutation, centreColour };
}

export function validateFourState(state: string): string[] {
  try { decodeFour(state); return []; }
  catch (error) { return [error instanceof Error ? error.message : '四阶状态无效']; }
}
