import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Group, Shape, ShapeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Eye, RotateCcw } from 'lucide-react';
import { AXES, COLORS, DEFAULT_SCHEME, FACES, FACE_NAMES, getBlocks, inLayer, sizeOf, type Face, type Color, type Move, type Vec } from '../domain/cube';
import CssCube from './CssCube';

const blockGeometry = new RoundedBoxGeometry(.95, .95, .95, 3, .055);
const stickerShape = new Shape();
const a = .397, r = .065;
stickerShape.moveTo(-a + r, -a);
stickerShape.lineTo(a - r, -a); stickerShape.quadraticCurveTo(a, -a, a, -a + r);
stickerShape.lineTo(a, a - r); stickerShape.quadraticCurveTo(a, a, a - r, a);
stickerShape.lineTo(-a + r, a); stickerShape.quadraticCurveTo(-a, a, -a, a - r);
stickerShape.lineTo(-a, -a + r); stickerShape.quadraticCurveTo(-a, -a, -a + r, -a);
const stickerGeometry = new ShapeGeometry(stickerShape);
const rotations: Record<Face, Vec> = {
  F: [0, 0, 0], B: [0, Math.PI, 0], U: [-Math.PI / 2, 0, 0],
  D: [Math.PI / 2, 0, 0], R: [0, Math.PI / 2, 0], L: [0, -Math.PI / 2, 0],
};
const blocksBySize = { 3: getBlocks(3), 4: getBlocks(4) };

function Controls({ view, interactive }: { view: Face | 'default'; interactive: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enablePan = false; c.enableZoom = false; c.enableDamping = true;
    c.enabled = interactive;
    controls.current = c;
    return () => { c.dispose(); };
  }, [camera, gl, interactive]);
  useEffect(() => {
    camera.up.set(0, 1, 0);
    if (view === 'default') camera.position.set(6.8, 5.4, 8.5);
    else {
      const { axis, sign } = AXES[view];
      const position = new Vector3();
      position.setComponent(axis, sign * 12);
      camera.position.copy(position);
      if (view === 'U') camera.up.set(0, 0, -1);
      if (view === 'D') camera.up.set(0, 0, 1);
    }
    camera.lookAt(0, 0, 0); controls.current?.update(); invalidate();
  }, [camera, view, invalidate]);
  useFrame(() => controls.current?.update());
  return null;
}
function Model({ state, scheme = DEFAULT_SCHEME, move, playId, slow, onEnd }: Omit<CubeViewProps, 'interactive' | 'compact'>) {
  const size = sizeOf(state), blocks = blocksBySize[size];
  const group = useRef<Group>(null);
  const started = useRef<number | null>(null);
  const completed = useRef(false);
  const callback = useRef(onEnd);
  callback.current = onEnd;
  const axis = move ? AXES[move.face].axis : 0;
  useEffect(() => {
    started.current = null; completed.current = false;
    group.current?.rotation.set(0, 0, 0);
  }, [state, move?.face, move?.turns, move?.width, playId, slow]);
  useFrame(({ clock }) => {
    if (!group.current || !move || !playId || completed.current) return;
    if (started.current === null) started.current = clock.elapsedTime;
    const duration = slow ? 2.4 : 1.05;
    const progress = Math.min(1, (clock.elapsedTime - started.current) / duration);
    const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    const angle = -AXES[move.face].sign * move.turns * Math.PI / 2;
    group.current.rotation[(['x', 'y', 'z'] as const)[axis]] = angle * eased;
    if (progress === 1) { completed.current = true; callback.current?.(); }
  });
  const renderBlock = (block: (typeof blocks)[number], active: boolean) => (
    <group key={block.position.join(',')} position={block.position}>
      <mesh geometry={blockGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={active ? '#243853' : '#242930'} roughness={.52} />
      </mesh>
      {block.facelets.map(f => (
        <mesh key={f.index} geometry={stickerGeometry}
          position={f.normal.map(n => n * .481) as Vec} rotation={rotations[f.face]}>
          <meshStandardMaterial color={COLORS[scheme[state[f.index] as Face]].hex}
            roughness={.34} metalness={.03}
            emissive={active ? '#7894bc' : '#000000'} emissiveIntensity={active ? .07 : 0} />
        </mesh>
      ))}
    </group>
  );
  const selected = (p: Vec) => move && inLayer(p, move, size);
  return <group scale={3 / size}>
    {blocks.filter(b => !selected(b.position)).map(b => renderBlock(b, false))}
    <group ref={group}>{blocks.filter(b => selected(b.position)).map(b => renderBlock(b, true))}</group>
  </group>;
}
class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function MiniFace({ state, face, scheme = DEFAULT_SCHEME }: { state: string; face: Face; scheme?: Record<Face, Color> }) {
  const size = sizeOf(state), cells = size * size;
  return <div className="mini-face" aria-label={FACE_NAMES[face]} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
    {[...state.slice(FACES.indexOf(face) * cells, (FACES.indexOf(face) + 1) * cells)].map((c, i) =>
      <span key={i} style={{ background: COLORS[scheme[c as Face]].hex }} />)}
  </div>;
}
export function CubeNet({ state, scheme = DEFAULT_SCHEME }: { state: string; scheme?: Record<Face, Color> }) {
  return <div className="cube-net">{(['U', 'L', 'F', 'R', 'B', 'D'] as Face[]).map(face =>
    <div key={face} className={`net-face net-${face}`}><span>{FACE_NAMES[face]}</span><MiniFace state={state} face={face} scheme={scheme} /></div>)}</div>;
}
type CubeViewProps = {
  state: string; scheme?: Record<Face, Color>; move?: Move;
  playId?: number; slow?: boolean; onEnd?: () => void;
  interactive?: boolean; compact?: boolean;
};
export default function CubeView({ state, scheme = DEFAULT_SCHEME, move, playId = 0, slow = false, onEnd, interactive = true, compact = false }: CubeViewProps) {
  const [view, setView] = useState<Face | 'default'>('default');
  const [reset, setReset] = useState(0);
  useEffect(() => { setView('default'); }, [state]);
  const webgl = useMemo(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      if (!context) return false;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch { return false; }
  }, []);
  const fallback = <CssCube state={state} scheme={scheme} move={move} playId={playId} slow={slow}
    view={view} reset={reset} interactive={interactive} onEnd={onEnd} />;
  return <div className={`cube-view ${compact ? 'compact' : ''}`}>
    {webgl ? <CanvasBoundary fallback={fallback}><Suspense fallback={<div className="loading-cube">正在准备魔方…</div>}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 30, position: [6.8, 5.4, 8.5] }} gl={{ antialias: true, alpha: true }}
        fallback={fallback}>
        <ambientLight intensity={1.6} />
        <directionalLight position={[5, 8, 6]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-5, 1, -4]} intensity={1} />
        <Model state={state} scheme={scheme} move={move} playId={playId} slow={slow} onEnd={onEnd} />
        <Controls key={reset} view={view} interactive={interactive} />
      </Canvas>
    </Suspense></CanvasBoundary> : fallback}
    {interactive && <div className="cube-view-controls">
      <button onClick={() => { setView('default'); setReset(n => n + 1); }} title="回到基准视角"><RotateCcw size={15} />重置视角</button>
      {move && <button onClick={() => setView(move.face)}><Eye size={15} />正对{FACE_NAMES[move.face]}</button>}
    </div>}
    {view !== 'default' && <p className="view-notice">正在正对{FACE_NAMES[view]}观察 · 只改变屏幕视角</p>}
  </div>;
}
