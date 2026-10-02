import Cube from 'cubejs';
import { applyMoves, atomicMoves, parseMoves, sizeOf, solvedState, validateState, type Move } from './domain/cube';
import { decodeFour } from './domain/four';
import { move444Tables, prepare444Tables, solve444 } from './vendor/four-solver/engine';

let initialized = false;
let fourInitialized = false;
self.onmessage = ({ data }: MessageEvent<{ id: string; state: string }>) => {
  const { id, state } = data;
  try {
    const errors = validateState(state);
    if (errors.length) throw new Error(errors.join('；'));
    const size = sizeOf(state);
    const solved = solvedState(size);
    if (state === solved) {
      self.postMessage({ id, type: 'result', moves: [] });
      return;
    }
    let moves: Move[];
    if (size === 4) {
      if (!fourInitialized) {
        self.postMessage({ id, type: 'progress', message: '正在准备四阶还原引擎，首次使用可能需要几十秒…' });
        prepare444Tables(); fourInitialized = true;
      }
      self.postMessage({ id, type: 'progress', message: '正在整理中心、配对棱块并处理四阶特殊情况…' });
      moves = atomicMoves(solve444(decodeFour(state)).map(index => {
        const { face, amount, depth } = move444Tables()[index].move;
        return { face, turns: amount === 3 ? -1 : amount, width: depth };
      }));
    } else {
      if (!initialized) {
        self.postMessage({ id, type: 'progress', message: '正在准备还原引擎，首次使用需要一点时间…' });
        Cube.initSolver();
        initialized = true;
      }
      self.postMessage({ id, type: 'progress', message: '正在寻找路线，并检查每一步…' });
      moves = atomicMoves(parseMoves(Cube.fromString(state).solve()));
    }
    if (applyMoves(state, moves) !== solved) throw new Error('路线验证未通过，请重新生成');
    self.postMessage({ id, type: 'result', moves });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : '还原引擎暂时不可用' });
  }
};
