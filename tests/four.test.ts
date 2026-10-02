import { describe, expect, it } from 'vitest';
import { applyMove, applyMoves, atomicMoves, DEFAULT_SCHEME, describeMove, FACES, FOUR_DEMO_STATE, getFacelets, inverseMove, moveToken, normalizeColors, parseMoves, SOLVED, solvedState, toColors, validateState, type Move } from '../src/domain/cube';
import { decodeFour } from '../src/domain/four';
import { findOrientations, rotateFaces, rotateGrid } from '../src/domain/orientation';
import { validSession } from '../src/domain/session';
import { homography, transformPhotoGeometry, type Photo } from '../src/domain/vision';
import { apply444Moves, createRandomSource, move444Tables, pieces444, randomCube444State, solve444, type State444 } from '../src/vendor/four-solver/engine';

// Encode using upstream geometry, independently of the generated decoder topology.
function encode(state: State444) {
  const p = pieces444(), faces = ['U', 'D', 'F', 'B', 'L', 'R'];
  const values: string[] = Array(96);
  p.cornerFacelets.forEach((ids, slot) => ids.forEach((_, j) => {
    values[ids[(j + state.cornerOrientation[slot]) % 3]] = p.facelets[p.cornerFacelets[state.cornerPermutation[slot]][j]].face;
  }));
  p.wingFacelets.forEach((ids, slot) => ids.forEach((id, j) => { values[id] = p.facelets[p.wingFacelets[state.wingPermutation[slot]][j]].face; }));
  p.centreFacelets.forEach((id, slot) => { values[id] = faces[state.centreColour[slot]]; });
  return getFacelets(4).map(f => {
    const id = p.facelets.findIndex(g => g.normal.every((v, j) => v === f.normal[j]) &&
      g.position.every((v, j) => v - g.normal[j] === f.position[j] * 2));
    return values[id];
  }).join('');
}
const solution = (state: string) => atomicMoves(solve444(decodeFour(state)).map(i => {
  const m = move444Tables()[i].move;
  return { face: m.face, width: m.depth, turns: m.amount === 3 ? -1 : m.amount } as Move;
}));
const solved = solvedState(4);

describe('四阶面片、有向翼棱和双层动作', () => {
  it('36 种外层/双层转动与独立求解引擎逐格相同，逆转和四次转动可恢复', () => {
    const input = randomCube444State(createRandomSource(617));
    const state = encode(input);
    expect(decodeFour(state)).toEqual(input);
    for (const [index, { move: m }] of move444Tables().entries()) {
      const move: Move = { face: m.face, width: m.depth, turns: m.amount === 3 ? -1 : m.amount };
      const result = applyMove(state, move);
      expect(result, moveToken(move)).toBe(encode(apply444Moves(input, [index])));
      expect(validateState(result)).toEqual([]);
      expect(applyMove(result, inverseMove(move))).toBe(state);
      expect(applyMoves(state, atomicMoves([move]))).toBe(result);
      expect(applyMoves(state, Array(4).fill(move))).toBe(state);
    }
  });
  it('宽转解析、中文说明、逆转和半圈拆分均保留两层宽度，三阶拒绝宽转', () => {
    expect(parseMoves("Rw U Fw2 B'").map(moveToken)).toEqual(['Rw', 'U', 'Fw2', "B'"]);
    expect(atomicMoves(parseMoves('Rw2'))).toEqual([{ face: 'R', width: 2, turns: 1 }, { face: 'R', width: 2, turns: 1 }]);
    expect(inverseMove({ face: 'R', width: 2, turns: 1 })).toEqual({ face: 'R', width: 2, turns: -1 });
    expect(describeMove({ face: 'R', width: 2, turns: 1 }).title).toContain('两层');
    expect(describeMove({ face: 'R', width: 2, turns: 1 }).detail).toContain('两竖排一起');
    expect(() => applyMove(SOLVED, { face: 'R', width: 2, turns: 1 })).toThrow();
  });
  it('不从四个活动中心猜测配色，支持自定义六面配色', () => {
    const scheme = { U: 'b', R: 'y', F: 'r', D: 'g', L: 'w', B: 'o' } as const;
    expect(normalizeColors(toColors(FOUR_DEMO_STATE, scheme), scheme)).toEqual({ state: FOUR_DEMO_STATE, scheme });
    expect(() => normalizeColors(toColors(solved), { ...DEFAULT_SCHEME, U: 'r' })).toThrow('不能重复');
  });
  it('拒绝单角扭转、镜像角、单翼翻转及颜色数量错误', () => {
    const corner = [...solved];
    [corner[15], corner[16], corner[35]] = [corner[16], corner[35], corner[15]];
    expect(validateState(corner.join('')).join()).toContain('角块朝向');
    const mirror = [...solved];
    [mirror[16], mirror[35]] = [mirror[35], mirror[16]];
    expect(validateState(mirror.join('')).join()).toContain('角块');
    const wing = [...solved];
    [wing[11], wing[17]] = [wing[17], wing[11]];
    expect(validateState(wing.join('')).join()).toContain('小棱块');
    expect(validateState('R' + solved.slice(1)).join()).toContain('16');
  });
});

describe('四阶任意输入真实求解与奇偶特殊状态', () => {
  it('30 组随机块状态，无打乱历史，求解后全部由独立几何模型还原', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const input = randomCube444State(createRandomSource(seed));
      const state = encode(input);
      expect(decodeFour(state)).toEqual(input);
      const moves = solution(state);
      expect(moves.length).toBeLessThan(1000);
      expect(applyMoves(state, moves), `seed ${seed}`).toBe(solved);
    }
  }, 120_000);
  it('允许并求解四阶单组棱翻转（OLL）与角棱奇偶不同（PLL）', () => {
    const oll = decodeFour(solved);
    [oll.wingPermutation[0], oll.wingPermutation[1]] = [oll.wingPermutation[1], oll.wingPermutation[0]];
    const pll = decodeFour(solved);
    [pll.cornerPermutation[0], pll.cornerPermutation[1]] = [pll.cornerPermutation[1], pll.cornerPermutation[0]];
    for (const input of [oll, pll]) {
      const state = encode(input);
      expect(validateState(state)).toEqual([]);
      expect(applyMoves(state, solution(state))).toBe(solved);
    }
  }, 60_000);
  it('完整保存宽转会话，损坏层宽、阶数或路线被拒绝，旧三阶会话兼容', () => {
    const initial = applyMoves(solved, parseMoves("Rw U Fw2"));
    const moves = atomicMoves(parseMoves("Fw2 U' Rw'"));
    const session = { version: 1, size: 4, initial, moves, scheme: DEFAULT_SCHEME, index: 1, demo: false, startedAt: 1000 };
    expect(validSession(session)).toBe(true);
    expect(validSession({ ...session, size: 3 })).toBe(false);
    expect(validSession({ ...session, moves: moves.map(m => ({ ...m, width: 1 })) })).toBe(false);
    expect(validSession({ ...session, moves: moves.map(m => ({ ...m, width: 3 })) })).toBe(false);
    expect(validSession({ version: 1, initial: SOLVED, moves: [], index: 0, scheme: DEFAULT_SCHEME, startedAt: 1000, demo: false })).toBe(true);
  });
});

describe('四阶照片方向和手工数据保留', () => {
  it('任意面旋转能找回 96 格原状态，扭角不会被修成可解', () => {
    const rotated = rotateFaces([...FOUR_DEMO_STATE], { U: 1, R: 2, F: 3, D: 2, L: 1, B: 3 }).join('');
    expect(findOrientations(rotated).some(c => c.state === FOUR_DEMO_STATE)).toBe(true);
    expect(findOrientations(solved)).toHaveLength(1);
    const invalid = [...solved];
    [invalid[15], invalid[16], invalid[35]] = [invalid[16], invalid[35], invalid[15]];
    expect(findOrientations(invalid.join(''))).toEqual([]);
  });
  it('16 格旋转、镜像保留手工颜色与置信度，并与透视投影一致', () => {
    const photo: Pick<Photo, 'corners' | 'samples'> = {
      corners: [{ x: .1, y: .2 }, { x: .8, y: .05 }, { x: .95, y: .9 }, { x: .05, y: .8 }],
      samples: Array.from({ length: 16 }, (_, i) => ({ rgb: [i, i * 3, i * 9], color: i === 0 ? 'o' : 'w', confidence: i === 0 ? 1 : .3 })),
    };
    const rotated = transformPhotoGeometry(photo, false);
    const project = homography(rotated.corners), source = homography(photo.corners);
    const indices = rotateGrid(Array.from({ length: 16 }, (_, i) => i), 1);
    indices.forEach((old, i) => {
      const a = source((old % 4 + .5) / 4, (Math.floor(old / 4) + .5) / 4);
      const b = project((i % 4 + .5) / 4, (Math.floor(i / 4) + .5) / 4);
      expect(b.x).toBeCloseTo(1 - a.y); expect(b.y).toBeCloseTo(a.x);
      expect(rotated.samples[i]).toBe(photo.samples[old]);
    });
    expect(transformPhotoGeometry(rotated, false, 3).samples).toEqual(photo.samples);
    const mirrored = transformPhotoGeometry(photo, true);
    expect(mirrored.samples[3]).toBe(photo.samples[0]);
    expect(transformPhotoGeometry(mirrored, true).samples).toEqual(photo.samples);
    for (const f of FACES) expect(rotateFaces([...FOUR_DEMO_STATE], { [f]: 4 }).join('')).toBe(FOUR_DEMO_STATE);
  });
});
