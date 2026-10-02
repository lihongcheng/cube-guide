import { FACES, sizeOf, validateState, type Face } from './cube';

export type FaceRotations = Partial<Record<Face, number>>;
export type OrientationCandidate = { state: string; rotations: FaceRotations };
export const quarterTurns = (turns: number) => ((turns % 4) + 4) % 4;

// 这是照片格子的平面旋转，不是拧动魔方的一层。
export function rotateGrid<T>(grid: readonly T[], turns: number): T[] {
  if (grid.length !== 9 && grid.length !== 16) throw new Error('每面需要 9 或 16 个格子');
  const size = Math.sqrt(grid.length);
  let result = [...grid];
  for (let i = 0; i < quarterTurns(turns); i++) {
    const before = result;
    result = before.map((_, index) => before[(size - 1 - index % size) * size + Math.floor(index / size)]);
  }
  return result;
}

export function rotateFaces<T>(values: readonly T[], rotations: FaceRotations): T[] {
  const cells = sizeOf(values) ** 2;
  return FACES.flatMap((face, index) => rotateGrid(values.slice(index * cells, (index + 1) * cells), rotations[face] ?? 0));
}

export function canCheckOrientation(state: string): boolean {
  if (state.length === 96) return !/[^URFDLB]/.test(state) && FACES.every(f => [...state].filter(c => c === f).length === 16);
  return state.length === 54 && !/[^URFDLB]/.test(state) &&
    FACES.every((face, i) => state[i * 9 + 4] === face && [...state].filter(c => c === face).length === 9);
}

// 穷举所有 4^6 个方向；相同状态去重，但不丢弃不同的合法状态。
export function findOrientations(state: string): OrientationCandidate[] {
  if (!canCheckOrientation(state)) return [];
  const cells = sizeOf(state) ** 2;
  const grids = FACES.map((_, i) => Array.from({ length: 4 }, (_, turns) =>
    rotateGrid([...state.slice(i * cells, (i + 1) * cells)], turns).join('')));
  const unique = new Map<string, OrientationCandidate>();
  const cost = (rotations: FaceRotations) => Object.values(rotations).filter(Boolean).length;
  for (let code = 0; code < 4096; code++) {
    const turns = FACES.map((_, i) => (code >> (i * 2)) & 3);
    const candidateState = grids.map((options, i) => options[turns[i]]).join('');
    const rotations = Object.fromEntries(FACES.map((face, i) => [face, turns[i]])) as FaceRotations;
    const previous = unique.get(candidateState);
    if (previous) {
      if (cost(rotations) < cost(previous.rotations)) unique.set(candidateState, { state: candidateState, rotations });
    } else if (!validateState(candidateState).length) {
      unique.set(candidateState, { state: candidateState, rotations });
    }
  }
  return [...unique.values()].sort((a, b) => cost(a.rotations) - cost(b.rotations));
}
