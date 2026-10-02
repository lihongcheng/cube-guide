export type State444 = {
  cornerPermutation: number[];
  cornerOrientation: number[];
  wingPermutation: number[];
  centreColour: number[];
};
export type WideMove = { face: 'U' | 'D' | 'F' | 'B' | 'L' | 'R'; depth: 1 | 2; amount: 1 | 2 | 3 };
export function solve444(state: State444): number[];
export function prepare444Tables(): void;
export function move444Tables(): { move: WideMove }[];
export function apply444Moves(state: State444, moves: number[]): State444;
export function pieces444(): {
  facelets: { face: WideMove['face']; position: number[]; normal: number[] }[];
  cornerFacelets: number[][];
  wingFacelets: number[][];
  centreFacelets: number[];
  centreFace: number[];
};
export function createRandomSource(seed: number): { nextUint32(): number };
export function randomCube444State(random: ReturnType<typeof createRandomSource>): State444;
