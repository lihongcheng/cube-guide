import { Check, CircleHelp } from 'lucide-react';
import { COLORS, COLOR_KEYS, FACES, FACE_NAMES, NEIGHBORS, sizeOf, type Color, type Face } from '../domain/cube';

export function FaceDirection({ face, colors }: { face: Face; colors: (Color | null)[] }) {
  const label = (neighbor: Face) => {
    const color = colors.length === 54 ? colors[FACES.indexOf(neighbor) * 9 + 4] : null;
    return `${FACE_NAMES[neighbor]}${color ? `（${COLORS[color].name}中心）` : ''}`;
  };
  return <div className="face-direction">
    <span>↑ 上边靠近{label(NEIGHBORS[face][0])}</span>
    <span>→ 右边靠近{label(NEIGHBORS[face][1])}</span>
  </div>;
}

export function Palette({ selected, onSelect }: { selected: Color; onSelect: (c: Color) => void }) {
  return <div className="palette" aria-label="选择画笔颜色">{COLOR_KEYS.map(c =>
    <button key={c} aria-label={`选择${COLORS[c].name}`} aria-pressed={selected === c} onClick={() => onSelect(c)}
      className={selected === c ? 'selected' : ''}>
      <span style={{ backgroundColor: COLORS[c].hex }}>{selected === c && <Check size={17} color={c === 'b' || c === 'r' ? '#fff' : '#26364b'} />}</span>
      <small>{COLORS[c].name.slice(0, 1)}</small>
    </button>)}</div>;
}
export function FaceEditor({ face, colors, onPaint, confidence, large = false }: {
  face: Face; colors: (Color | null)[]; onPaint?: (index: number) => void; confidence?: number[]; large?: boolean;
}) {
  const size = sizeOf(colors), cells = size * size;
  const start = FACES.indexOf(face) * cells;
  return <div className={`face-editor ${large ? 'large' : ''}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-label={`${FACE_NAMES[face]}${size === 3 ? '九宫格' : '十六格'}`}>
    {Array.from({ length: cells }, (_, i) => {
      const c = colors[start + i];
      return <button key={i} className={`${!c ? 'empty' : ''} ${confidence && confidence[i] < .25 ? 'uncertain' : ''}`}
        style={{ backgroundColor: c ? COLORS[c].hex : undefined }}
        onClick={() => onPaint?.(start + i)} disabled={!onPaint}
        aria-label={`${FACE_NAMES[face]}第${i + 1}格：${c ? COLORS[c].name : '未录入'}`}>
        {!c ? '+' : size === 3 && i === 4 ? <span className="center-mark" /> : null}
        {c && confidence && confidence[i] < .25 && <CircleHelp size={large ? 16 : 11} />}
      </button>;
    })}
  </div>;
}
