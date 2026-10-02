import { beforeAll, describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { applyMove, applyMoves, atomicMoves, DEMO_STATE, FACES, inverseMove, normalizeColors, parseMoves, SOLVED, toColors, validateState, type Move } from '../src/domain/cube';
import { homography, classify } from '../src/domain/vision';
import { validSession } from '../src/domain/session';

describe('几何置换模型与 cubejs 独立对照', () => {
  for (const face of FACES) for (const turns of [1, -1, 2] as const) {
    const token = face + (turns === 2 ? '2' : turns === -1 ? "'" : '');
    it(`${token} 与求解库的定义相同，并可逆`, () => {
      const move = { face, turns };
      const actual = applyMove(DEMO_STATE, move);
      expect(actual).toBe(Cube.fromString(DEMO_STATE).move(token).asString());
      expect(applyMove(actual, inverseMove(move))).toBe(DEMO_STATE);
      expect(validateState(actual)).toEqual([]);
    });
  }
  it('四次正转复原，半圈拆分不改变效果', () => {
    for (const face of FACES) {
      expect(applyMoves(DEMO_STATE, Array(4).fill({ face, turns: 1 }))).toBe(DEMO_STATE);
      expect(applyMoves(DEMO_STATE, atomicMoves([{ face, turns: 2 }]))).toBe(applyMove(DEMO_STATE, { face, turns: 2 }));
    }
  });
  it('通过中心映射支持任意六色方向', () => {
    const colors = toColors(DEMO_STATE, { U: 'b', R: 'y', F: 'r', D: 'g', L: 'w', B: 'o' });
    expect(normalizeColors(colors).state).toBe(DEMO_STATE);
  });
});
describe('非法状态校验', () => {
  it('拒绝颜色数量错误和重复中心', () => {
    expect(validateState('R' + SOLVED.slice(1)).length).toBeGreaterThan(0);
    const colors = toColors(SOLVED); colors[4] = colors[13];
    expect(() => normalizeColors(colors)).toThrow('中心');
  });
  it('拒绝单棱翻转、单角扭转和奇偶不一致', () => {
    const edge = [...SOLVED]; [edge[5], edge[10]] = [edge[10], edge[5]];
    expect(validateState(edge.join('')).join()).toContain('棱块朝向');
    const corner = [...SOLVED]; [corner[8], corner[9], corner[20]] = [corner[9], corner[20], corner[8]];
    expect(validateState(corner.join('')).join()).toContain('角块朝向');
    const permutation = [...SOLVED]; [permutation[10], permutation[19]] = [permutation[19], permutation[10]];
    expect(validateState(permutation.join('')).join()).toContain('排列');
  });
  it('拒绝镜像角块及不存在的块', () => {
    const mirrored = [...SOLVED]; [mirrored[9], mirrored[20]] = [mirrored[20], mirrored[9]];
    expect(validateState(mirrored.join('')).join()).toContain('角块');
  });
});
describe('真正的求解闭环', () => {
  beforeAll(() => { Cube.initSolver(); }, 60_000);
  it('100 组固定种子的合法打乱，求解后全部由独立模型验证', () => {
    let seed = 123456789;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let i = 0; i < 100; i++) {
      const scramble: Move[] = Array.from({ length: 25 }, () => ({ face: FACES[(rand() >>> 8) % 6], turns: ([1, -1, 2] as const)[(rand() >>> 8) % 3] }));
      const state = applyMoves(SOLVED, scramble);
      expect(validateState(state)).toEqual([]);
      const moves = atomicMoves(parseMoves(Cube.fromString(state).solve()));
      expect(applyMoves(state, moves)).toBe(SOLVED);
    }
  }, 120_000);
});
describe('照片投影和颜色分类', () => {
  it('非对称透视四角准确映射，中心在范围内', () => {
    const p = [{ x: .1, y: .2 }, { x: .8, y: .05 }, { x: .95, y: .9 }, { x: .05, y: .8 }];
    const project = homography(p);
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
      expect(project(u, v).x).toBeCloseTo(p[i].x);
      expect(project(u, v).y).toBeCloseTo(p[i].y);
    });
    expect(project(.5, .5).x).toBeGreaterThan(.1);
    expect(project(.5, .5).x).toBeLessThan(.95);
  });
  it('拒绝交叉四角', () => {
    expect(() => homography([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toThrow();
  });
  it('参考颜色可区分，照片红橙不合并', () => {
    expect(classify([235, 35, 45]).color).toBe('r');
    expect(classify([255, 135, 25]).color).toBe('o');
    expect(classify([240, 240, 240]).color).toBe('w');
  });
});
it('拒绝不一致或损坏的进度快照', () => {
  expect(validSession({})).toBe(false);
  expect(validSession({ version: 1, initial: DEMO_STATE, moves: [], index: 0 })).toBe(false);
});
