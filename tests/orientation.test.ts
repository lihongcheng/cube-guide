import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { applyMove, applyMoves, DEMO_STATE, FACES, parseMoves, SOLVED, validateState } from '../src/domain/cube';
import { canCheckOrientation, findOrientations, rotateFaces, rotateGrid } from '../src/domain/orientation';
import { homography, transformPhotoGeometry, type Photo } from '../src/domain/vision';

describe('六面照片方向诊断', () => {
  it('整面旋转遵循顺时针，并保持中心和原数组不变', () => {
    const grid = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(rotateGrid(grid, 1)).toEqual([6, 3, 0, 7, 4, 1, 8, 5, 2]);
    expect(rotateGrid(rotateGrid(grid, 1), -1)).toEqual(grid);
    expect(rotateGrid(grid, 4)).toEqual(grid);
    expect(grid).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('旋转上面照片会被拦截，方向诊断可找回原状态并真正还原', () => {
    const rotated = rotateFaces([...DEMO_STATE], { U: 1 }).join('');
    expect(validateState(rotated).length).toBeGreaterThan(0);
    const candidate = findOrientations(rotated).find(c => c.state === DEMO_STATE)!;
    expect(candidate).toBeDefined();
    expect(rotateFaces([...rotated], candidate.rotations).join('')).toBe(DEMO_STATE);
    Cube.initSolver();
    expect(applyMoves(candidate.state, parseMoves(Cube.fromString(candidate.state).solve()))).toBe(SOLVED);
  }, 60_000);
  it('20 组不同打乱和六面任意拍摄角度，全部找回原状态', () => {
    let seed = 438971;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
    for (let i = 0; i < 20; i++) {
      const state = applyMoves(SOLVED, Array.from({ length: 25 }, () => ({
        face: FACES[random() % 6], turns: ([1, -1, 2] as const)[random() % 3],
      })));
      const rotations = Object.fromEntries(FACES.map(f => [f, random() % 4]));
      const input = rotateFaces([...state], rotations).join('');
      const candidates = findOrientations(input);
      expect(candidates.some(c => c.state === state)).toBe(true);
      for (const candidate of candidates) {
        expect(validateState(candidate.state)).toEqual([]);
        expect(rotateFaces([...input], candidate.rotations).join('')).toBe(candidate.state);
      }
    }
  }, 30_000);
  it('保留不同合法候选，对称照片按状态去重且优先少改动', () => {
    expect(findOrientations(applyMove(SOLVED, { face: 'R', turns: 1 })).length).toBeGreaterThan(1);
    const candidates = findOrientations(SOLVED);
    expect(candidates).toHaveLength(1);
    expect(Object.values(candidates[0].rotations).every(t => t === 0)).toBe(true);
  });
  it('真实单角扭转不能靠方向诊断伪装成合法状态', () => {
    const corner = [...SOLVED];
    [corner[8], corner[9], corner[20]] = [corner[9], corner[20], corner[8]];
    const state = corner.join('');
    expect(validateState(state).join()).toContain('角块朝向不一致');
    expect(canCheckOrientation(state)).toBe(true);
    expect(findOrientations(state)).toEqual([]);
    expect(canCheckOrientation('R' + SOLVED.slice(1))).toBe(false);
    expect(findOrientations('')).toEqual([]);
  });
});

describe('保留照片四角、置信度和手工校色', () => {
  const photo: Pick<Photo, 'corners' | 'samples'> = {
    corners: [{ x: .1, y: .2 }, { x: .8, y: .05 }, { x: .95, y: .9 }, { x: .05, y: .8 }],
    samples: Array.from({ length: 9 }, (_, i) => ({ rgb: [i, i * 3, i * 9], color: i === 0 ? 'o' : 'w', confidence: i === 0 ? 1 : .3 })),
  };
  it('旋转后九个取样位置与四角投影对应，四次旋转恢复所有数据', () => {
    const rotated = transformPhotoGeometry(photo, false);
    const sourceProject = homography(photo.corners), project = homography(rotated.corners);
    const order = rotateGrid([0, 1, 2, 3, 4, 5, 6, 7, 8], 1);
    order.forEach((old, cell) => {
      const source = sourceProject((old % 3 + .5) / 3, (Math.floor(old / 3) + .5) / 3);
      const point = project((cell % 3 + .5) / 3, (Math.floor(cell / 3) + .5) / 3);
      expect(point.x).toBeCloseTo(1 - source.y);
      expect(point.y).toBeCloseTo(source.x);
      expect(rotated.samples[cell]).toBe(photo.samples[old]);
    });
    const restored = transformPhotoGeometry(rotated, false, 3);
    expect(restored.samples).toEqual(photo.samples);
    restored.corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(photo.corners[i].x); expect(p.y).toBeCloseTo(photo.corners[i].y);
    });
  });
  it('镜像同样保留手工颜色，两次镜像恢复原投影', () => {
    const mirrored = transformPhotoGeometry(photo, true);
    expect(mirrored.samples[2]).toBe(photo.samples[0]);
    expect(() => homography(mirrored.corners)).not.toThrow();
    const restored = transformPhotoGeometry(mirrored, true);
    expect(restored.samples).toEqual(photo.samples);
    restored.corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(photo.corners[i].x); expect(p.y).toBeCloseTo(photo.corners[i].y);
    });
    expect(transformPhotoGeometry({ corners: photo.corners, samples: [] }, false).samples).toEqual([]);
  });
});
