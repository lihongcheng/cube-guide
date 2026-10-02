import { useEffect, useRef, useState } from 'react';
import { Download, ScanLine } from 'lucide-react';
import { CAPTURE_ORDER, FACES, FACE_NAMES, sizeOf, toColors, type Color, type Face } from '../domain/cube';
import { canCheckOrientation, type FaceRotations, type OrientationCandidate } from '../domain/orientation';
import { FaceDirection, FaceEditor } from './ColorEditor';

export default function OrientationAssistant({ state, scheme, colors, errors, onApply }: {
  state: string; scheme: Record<Face, Color>; colors: (Color | null)[]; errors: string[];
  onApply: (rotations: FaceRotations) => void;
}) {
  const [candidates, setCandidates] = useState<OrientationCandidate[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const size = sizeOf(colors), cells = size * size;
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    worker.current?.terminate();
    if (timer.current) clearTimeout(timer.current);
  }, []);
  function stop() {
    worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
  }
  function search() {
    stop(); setBusy(true); setError(''); setCandidates(null); setIndex(0);
    try {
      const job = new Worker(new URL('../orientation.worker.ts', import.meta.url), { type: 'module' });
      worker.current = job;
      job.onmessage = ({ data }: MessageEvent<{ candidates?: OrientationCandidate[]; error?: string }>) => {
        if (worker.current !== job) return;
        stop();
        if (data.error) setError(data.error); else setCandidates(data.candidates ?? []);
      };
      job.onerror = () => { stop(); setError('方向检查未能启动，请重试，或用每面的旋转按钮调整。'); };
      timer.current = setTimeout(() => { stop(); setError('方向检查超时，颜色和照片已保留，可以重试。'); }, 15_000);
      job.postMessage({ state });
    } catch { stop(); setError('当前浏览器无法启动方向检查，请用每面的旋转按钮调整。'); }
  }
  function download() {
    const diagnostic = {
      version: 1, size, scheme, faceOrder: FACES, cellOrder: '每面正视，按照片从左到右、从上到下',
      faces: Object.fromEntries(FACES.map((f, i) => [f, colors.slice(i * cells, (i + 1) * cells)])),
      state, errors, orientationCandidateCount: candidates?.length ?? null,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'cube-diagnostic.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const candidate = candidates?.[index];
  const previewColors = candidate ? toColors(candidate.state, scheme) : [];
  return <section id="photo-orientation-check" className="orientation-assistant" aria-label="照片方向检查" tabIndex={-1}>
    <h3>颜色都对，仍然无法继续？</h3>
    <p>每面颜色正确后，六面的上下、左右方向也要对齐。可先检查照片方向，或按上方提示手动旋转整面格子。</p>
    <div className="orientation-actions">
      <button className="button secondary" disabled={!canCheckOrientation(state) || busy} onClick={search}><ScanLine size={16} />{busy ? '正在检查六面方向…' : '检查照片方向'}</button>
      {busy && <button className="text-button" onClick={stop}>取消检查</button>}
      <button className="text-button" onClick={download}><Download size={14} />导出诊断数据</button>
    </div>
    {!canCheckOrientation(state) && <p>{size === 4 ? '请先补齐 96 格、确保每种颜色各 16 格，并检查还原后的六面配色。' : '请先补齐 54 格、确保每种颜色各 9 格，并且六个中心颜色不同。'}</p>}
    {error && <p role="alert">{error}</p>}
    {candidates && <div role="status">
      {candidates.length === 0 ? <p className="orientation-result">仅旋转照片无法得到可还原的状态。请核对是否把照片放错面、使用了镜像、漏拍或重复拍摄，以及角落的颜色；如果都一致，可导出诊断数据进一步排查。</p>
        : <p className="orientation-result">找到 {candidates.length} 种可还原的方向组合。{candidates.length > 1 ? '存在多个候选，请逐一核对六面，选择与实物完全一致的一种。' : '请按标注的上边和右边对照实体魔方。'}当前颜色尚未修改。</p>}
    </div>}
    {candidate && <>
      <div className="candidate-navigation">
        <button className="button subtle" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>上一个</button>
        <span>候选 {index + 1} / {candidates!.length}</span>
        <button className="button subtle" disabled={index === candidates!.length - 1} onClick={() => setIndex(i => i + 1)}>下一个</button>
      </div>
      <div className="candidate-grid">{CAPTURE_ORDER.map(face => {
        const turns = candidate.rotations[face] ?? 0;
        return <div key={face}>
          <b>{FACE_NAMES[face]}</b>
          <FaceDirection face={face} colors={previewColors} />
          <FaceEditor face={face} colors={previewColors} />
          <small>{turns === 0 ? '保持当前方向' : turns === 3 ? '照片逆时针转 90°' : `照片顺时针转 ${turns * 90}°`}</small>
        </div>;
      })}</div>
      <p>这里只调整照片的朝向，手里的魔方不要拧动。请确认六面每格都与实物一致，再应用此方向。</p>
      <button className="button primary full" onClick={() => onApply(candidate.rotations)}>与实物一致，应用此方向</button>
    </>}
  </section>;
}
