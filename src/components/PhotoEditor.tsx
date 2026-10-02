import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { Camera, FlipHorizontal2, RotateCw, ScanLine, Upload, AlertCircle } from 'lucide-react';
import { FACE_NAMES, NEIGHBORS, type CubeSize, type Face } from '../domain/cube';
import { DEFAULT_CORNERS, homography, importPhoto, samplePhoto, transformCapturedPhoto, type Photo, type Point } from '../domain/vision';

export default function PhotoEditor({ face, photo, onChange, size = 3 }: { face: Face; photo?: Photo; onChange: (photo: Photo, source?: Photo) => void; size?: CubeSize }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const [top, right, bottom, left] = NEIGHBORS[face];
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try {
      const url = await importPhoto(file);
      onChange({ url, corners: DEFAULT_CORNERS.map(p => ({ ...p })), samples: [] });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function transform(mirror: boolean) {
    if (!photo) return;
    setBusy(true); setError('');
    try { onChange(await transformCapturedPhoto(photo, mirror), photo); }
    catch { setError('照片调整失败，请重新选择照片'); }
    finally { setBusy(false); }
  }
  async function recognize() {
    if (!photo) return;
    setBusy(true); setError('');
    try { onChange({ ...photo, samples: await samplePhoto(photo.url, photo.corners, size) }, photo); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function drag(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current === null || !photo || !svg.current) return;
    const rect = svg.current.getBoundingClientRect();
    const point = { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
    const corners = photo.corners.map((p, i) => i === dragging.current ? point : p);
    onChange({ ...photo, corners, samples: [] });
  }
  let lines: [Point, Point][] = [];
  if (photo) try {
    const project = homography(photo.corners);
    lines = Array.from({ length: size - 1 }, (_, i) => (i + 1) / size).flatMap(t => [[project(t, 0), project(t, 1)], [project(0, t), project(1, t)]] as [Point, Point][]);
  } catch { /* 错误在用户点击识别时解释；拖动期间保留编辑能力。 */ }
  return <div className="photo-editor">
    <div className="photo-direction"><span>↑ 照片上边靠近「{FACE_NAMES[top]}」</span></div>
    {photo ? <div className="photo-preview">
      <img src={photo.url} alt={`${FACE_NAMES[face]}原始照片`} draggable={false} />
      <svg ref={svg} viewBox="0 0 1000 1000" preserveAspectRatio="none" onPointerMove={drag}
        onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
        <polygon points={photo.corners.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} />
        {lines.map(([a, b], i) => <line key={i} x1={a.x * 1000} y1={a.y * 1000} x2={b.x * 1000} y2={b.y * 1000} />)}
        {photo.corners.map((p, i) => <g key={i} onPointerDown={event => {
          if (busy) return;
          dragging.current = i; svg.current?.setPointerCapture(event.pointerId); event.preventDefault();
        }}>
          <circle cx={p.x * 1000} cy={p.y * 1000} r={24} className="corner-hit" />
          <circle cx={p.x * 1000} cy={p.y * 1000} r={13} />
          <text x={p.x * 1000} y={p.y * 1000 - 28} textAnchor="middle">{i + 1}</text>
        </g>)}
      </svg>
      <span className="edge-label edge-left">{FACE_NAMES[left]}</span>
      <span className="edge-label edge-right">{FACE_NAMES[right]}</span>
    </div> : <div className="upload-zone">
      <div className="upload-illustration"><Camera size={38} strokeWidth={1.3} /><i /><i /><i /><i /></div>
      <h3>拍下魔方的{FACE_NAMES[face]}</h3>
      <p>{size === 4 ? '十六' : '九'}个格子完整入镜，让这一面正对镜头</p>
      <label className="button primary"><Camera size={17} />拍照<input type="file" accept="image/*" capture="environment" onChange={upload} disabled={busy} /></label>
      <label className="upload-link"><Upload size={14} />或从相册选择<input type="file" accept="image/*" onChange={upload} disabled={busy} /></label>
      <small>JPEG / PNG / WebP · 最大 20 MB</small>
    </div>}
    <div className="photo-bottom-direction">↓ 照片下边靠近「{FACE_NAMES[bottom]}」</div>
    {photo && <>
      <p className="helper">拖动四个蓝点，对齐这一面的四个外角。按 1 → 2 → 3 → 4 顺序框选。</p>
      <div className="photo-tools">
        <button className="button subtle" disabled={busy} onClick={() => transform(false)}><RotateCw size={15} />旋转</button>
        <button className="button subtle" disabled={busy} onClick={() => transform(true)}><FlipHorizontal2 size={15} />镜像</button>
        <label className={`button subtle ${busy ? 'disabled' : ''}`}><Upload size={15} />换一张<input type="file" accept="image/*" onChange={upload} disabled={busy} /></label>
        <button className="button primary" disabled={busy} onClick={recognize}><ScanLine size={16} />{busy ? '处理中…' : '识别颜色'}</button>
      </div>
    </>}
    {busy && !photo && <p role="status">正在读取照片…</p>}
    {error && <div className="alert" role="alert"><AlertCircle size={18} />{error}</div>}
  </div>;
}
