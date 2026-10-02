import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AXES, COLORS, FACES, getBlocks, inLayer, sizeOf, type Color, type Face, type Move, type Vec } from '../domain/cube';

const blocksBySize = { 3: getBlocks(3), 4: getBlocks(4) };
const faceTransform: Record<Face, string> = { F: '', B: 'rotateY(180deg)', R: 'rotateY(90deg)', L: 'rotateY(-90deg)', U: 'rotateX(90deg)', D: 'rotateX(-90deg)' };
const camera: Record<Face | 'default', [number, number]> = { default: [-26, -35], F: [0, 0], R: [0, -90], B: [0, -180], L: [0, 90], U: [-90, 0], D: [90, 0] };

export default function CssCube({ state, scheme, move, playId, slow, view, reset, interactive, onEnd }: {
  state: string; scheme: Record<Face, Color>; move?: Move; playId: number; slow: boolean;
  view: Face | 'default'; reset: number; interactive: boolean; onEnd?: () => void;
}) {
  const size = sizeOf(state), blocks = blocksBySize[size];
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; angles: [number, number] } | null>(null);
  const [unit, setUnit] = useState(62);
  const [angles, setAngles] = useState<[number, number]>(camera[view]);
  useEffect(() => { setAngles(camera[view]); }, [view, reset, state]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setUnit(Math.min(entry.contentRect.width / 5.6, entry.contentRect.height / 4.7, 78) * 3 / size));
    observer.observe(element);
    return () => observer.disconnect();
  }, [size]);
  const axis = move ? AXES[move.face].axis : 0;
  const selected = (position: Vec) => !!move && inLayer(position, move, size);
  const angle = move ? -AXES[move.face].sign * move.turns * 90 * (axis === 1 ? 1 : -1) : 0;
  const turn = `rotate${['X', 'Y', 'Z'][axis]}(${angle}deg)`;
  const renderBlock = (block: (typeof blocks)[number]) => <div className="css-cubie" key={block.position.join(',')} style={{ transform: `translate3d(${block.position[0] * unit}px,${-block.position[1] * unit}px,${block.position[2] * unit}px)` }}>
    {FACES.map(face => {
      const facelet = block.facelets.find(f => f.face === face);
      return <div className={`css-cubie-face ${selected(block.position) ? 'highlight' : ''}`} key={face} style={{ width: unit, height: unit, marginLeft: -unit / 2, marginTop: -unit / 2, transform: `${faceTransform[face]} translateZ(${unit / 2}px)` }}>
        {facelet && <div style={{ background: COLORS[scheme[state[facelet.index] as Face]].hex }} />}
      </div>;
    })}
  </div>;
  return <div ref={root} className="css-cube-viewport" aria-label="三维魔方" onPointerDown={event => {
    if (!interactive) return;
    drag.current = { x: event.clientX, y: event.clientY, angles }; event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={event => {
    if (!drag.current) return;
    setAngles([drag.current.angles[0] - (event.clientY - drag.current.y) * .45, drag.current.angles[1] + (event.clientX - drag.current.x) * .45]);
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <div className="css-cube-shadow" />
    <div className="css-cube-world" style={{ transform: `rotateX(${angles[0]}deg) rotateY(${angles[1]}deg)` }}>
      {blocks.filter(b => !selected(b.position)).map(renderBlock)}
      <div key={`${state}-${playId}-${slow}-${move?.face}-${move?.turns}-${move?.width}`} className={`css-cube-layer ${move && playId ? 'animating' : ''}`}
        style={{ '--turn': turn, animationDuration: `${slow ? 2.4 : 1.05}s` } as CSSProperties}
        onAnimationEnd={onEnd}>
        {blocks.filter(b => selected(b.position)).map(renderBlock)}
      </div>
    </div>
  </div>;
}
