import { applyMoves, COLOR_KEYS, FACES, sizeOf, solvedState, validateState, type Color, type CubeSize, type Face, type Move } from './cube';

export type Session = {
  version: 1;
  size?: CubeSize;
  initial: string;
  scheme: Record<Face, Color>;
  moves: Move[];
  index: number;
  startedAt: number;
  finishedAt?: number;
  demo: boolean;
};
export const STORAGE_KEY = 'cube-guide-session-v1';
export const sessionKey = (size: CubeSize) => size === 3 ? STORAGE_KEY : 'cube-guide-session-4-v1';
export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Session;
  if (s.version !== 1 || typeof s.initial !== 'string' || validateState(s.initial).length) return false;
  const size = sizeOf(s.initial);
  if (s.size !== undefined && s.size !== size) return false;
  if (!s.scheme || FACES.some(f => !COLOR_KEYS.includes(s.scheme[f])) || new Set(Object.values(s.scheme)).size !== 6) return false;
  if (!Array.isArray(s.moves) || s.moves.length > (size === 4 ? 1000 : 200) || s.moves.some(m =>
    !m || !FACES.includes(m.face) || ![1, -1].includes(m.turns) ||
    (m.width !== undefined && m.width !== 1 && (m.width !== 2 || size !== 4)))) return false;
  if (!Number.isInteger(s.index) || s.index < 0 || s.index > s.moves.length) return false;
  if (!Number.isFinite(s.startedAt) || typeof s.demo !== 'boolean') return false;
  if (s.finishedAt !== undefined && (!Number.isFinite(s.finishedAt) || s.index !== s.moves.length || s.finishedAt < s.startedAt)) return false;
  return applyMoves(s.initial, s.moves) === solvedState(size);
}
export function loadSession(size: CubeSize = 3): Session | null {
  try {
    const raw = localStorage.getItem(sessionKey(size));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validSession(parsed) && sizeOf(parsed.initial) === size ? parsed : null;
  } catch { return null; }
}
