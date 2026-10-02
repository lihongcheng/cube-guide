import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import { ArrowRight, ArrowLeft, ArrowUpRight, Box, Camera, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Expand, Flag, Hand, ImagePlus, Lightbulb, LoaderCircle, LockKeyhole, Play, RotateCcw, RotateCw, ScanLine, ShieldCheck, Sparkles, Trophy, Undo2, X } from 'lucide-react';
import CubeView, { CubeNet, MiniFace } from './components/CubeView';
import PhotoEditor from './components/PhotoEditor';
import { FaceDirection, FaceEditor, Palette } from './components/ColorEditor';
import OrientationAssistant from './components/OrientationAssistant';
import { applyMoves, CAPTURE_ORDER, COLORS, COLOR_KEYS, DEFAULT_SCHEME, demoState, describeMove, FACES, FACE_NAMES, inverseMove, normalizeColors, solvedState, validateState, type Color, type CubeSize, type Face, type Move } from './domain/cube';
import { classify, transformCapturedPhoto, type Photo, type RGB } from './domain/vision';
import { rotateFaces, type FaceRotations } from './domain/orientation';
import { loadSession, sessionKey, type Session } from './domain/session';

type Page = 'home' | 'capture' | 'review' | 'guide' | 'complete';
type Draft = { version: 1; colors: (Color | null)[]; photos: Partial<Record<Face, Photo>>; confirmed: Face[]; scheme?: Record<Face, Color> };
const draftKey = (size: CubeSize) => size === 3 ? 'cube-guide-draft-v1' : 'cube-guide-draft-4-v1';
const SIZE_KEY = 'cube-guide-size';
const steps = [{ title: '拍下六个面', label: '拍照上传', icon: Camera }, { title: '确认颜色', label: '校对颜色', icon: ScanLine }, { title: '跟着转动', label: '开始还原', icon: Box }];
function Logo() { return <><span className="logo-icon"><Box size={23} strokeWidth={1.7} /></span><span>魔方一步通<span className="logo-dot">.</span></span></>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = Array.from(document.querySelectorAll<HTMLElement>('.modal button:not(:disabled), .modal a[href], .modal input:not(:disabled)'));
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
      <button ref={closeRef} className="icon-button close-modal" onClick={onClose} aria-label="关闭"><X size={21} /></button>
      <h2>{title}</h2>{children}
    </section>
  </div>;
}
export default function App() {
  const [size, setSize] = useState<CubeSize>(() => {
    try { return localStorage.getItem(SIZE_KEY) === '4' ? 4 : 3; } catch { return 3; }
  });
  function selectSize(value: CubeSize) {
    try { localStorage.setItem(SIZE_KEY, String(value)); } catch { /* 本次仍可切换。 */ }
    setSize(value);
  }
  return <CubeApp key={size} size={size} onSize={selectSize} />;
}
function CubeApp({ size, onSize }: { size: CubeSize; onSize: (size: CubeSize) => void }) {
  const cells = size * size, totalCells = cells * 6;
  const DRAFT_KEY = draftKey(size), STORAGE_KEY = sessionKey(size);
  const DEMO_STATE = demoState(size), SOLVED = solvedState(size);
  const [targetScheme, setTargetScheme] = useState(DEFAULT_SCHEME);
  const [page, setPage] = useState<Page>('home');
  const [face, setFace] = useState<Face>('F');
  const [colors, setColors] = useState<(Color | null)[]>(Array(totalCells).fill(null));
  const [photos, setPhotos] = useState<Partial<Record<Face, Photo>>>({});
  const [confirmed, setConfirmed] = useState<Face[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [paint, setPaint] = useState<Color>('w');
  const [session, setSession] = useState<Session | null>(() => loadSession(size));
  const [guideReady, setGuideReady] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [dialog, setDialog] = useState<'help' | 'undo' | 'check' | 'delete' | null>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const [rotating, setRotating] = useState(false);
  const rotationId = useRef(0);
  const latestDraft = useRef({ colors, photos, page });
  useLayoutEffect(() => { latestDraft.current = { colors, photos, page }; }, [colors, photos, page]);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeId = useRef('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    get<Draft>(DRAFT_KEY).then(draft => {
      if (!active) return;
      if (draft?.version === 1 && draft.colors?.length === totalCells && draft.colors.every(c => c === null || COLOR_KEYS.includes(c)) &&
        Array.isArray(draft.confirmed) && draft.confirmed.every(f => FACES.includes(f))) {
        setColors(draft.colors); setPhotos(draft.photos ?? {}); setConfirmed(draft.confirmed);
        if (draft.scheme && FACES.every(f => COLOR_KEYS.includes(draft.scheme![f])) && new Set(Object.values(draft.scheme)).size === 6) setTargetScheme(draft.scheme);
      }
    }).catch(() => { if (active) setStorageWarning('浏览器无法保存照片，本次仍可继续使用。'); }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); };
  }, [DRAFT_KEY, totalCells]);
  useEffect(() => {
    if (!draftReady) return;
    const id = setTimeout(() => {
      set(DRAFT_KEY, { version: 1, colors, photos, confirmed, scheme: targetScheme } satisfies Draft)
        .catch(() => setStorageWarning('照片未能保存，关闭页面后可能需要重新导入。'));
    }, 500);
    return () => clearTimeout(id);
  }, [colors, photos, confirmed, draftReady, targetScheme, DRAFT_KEY]);
  useEffect(() => {
    if (!session) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
    catch { setStorageWarning('当前浏览器无法保存进度，请尽量不要关闭页面。'); }
  }, [session, STORAGE_KEY]);
  useEffect(() => {
    if (page !== 'guide') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [page]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);
  const closeDialog = useCallback(() => setDialog(null), []);
  const animationEnd = useCallback(() => setPlaying(false), []);
  const currentState = useMemo(() => session ? applyMoves(session.initial, session.moves.slice(0, session.index)) : DEMO_STATE, [session, DEMO_STATE]);
  const currentMove = session ? undoing ? inverseMove(session.moves[session.index - 1]) : session.moves[session.index] : undefined;
  const description = currentMove ? describeMove(currentMove) : null;
  const validation = useMemo(() => {
    if (colors.some(c => !c)) return { errors: [`还有 ${colors.filter(c => !c).length} 个格子未录入`], state: '', scheme: DEFAULT_SCHEME };
    try {
      const normalized = normalizeColors(colors as Color[], targetScheme);
      return { ...normalized, errors: validateState(normalized.state) };
    } catch (e) { return { errors: [(e as Error).message], state: '', scheme: DEFAULT_SCHEME }; }
  }, [colors, targetScheme]);
  const stepNumber = page === 'capture' ? 0 : page === 'review' ? 1 : 2;
  const duration = session ? Math.max(0, Math.floor(((session.finishedAt ?? now) - session.startedAt) / 1000)) : 0;
  const timeLabel = `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;

  function goCapture() { setPage('capture'); setError(''); setUndoing(false); }
  async function switchSize(next: CubeSize) {
    if (!draftReady || next === size) return;
    // Flush the debounce before remounting; each order has its own untouched draft.
    try { await set(DRAFT_KEY, { version: 1, colors, photos, confirmed, scheme: targetScheme } satisfies Draft); }
    catch {
      if (colors.some(Boolean) || Object.keys(photos).length) {
        setStorageWarning('草稿未能保存，暂不切换阶数，请先重试。'); return;
      }
      // With an empty draft, unavailable storage must not prevent starting 4x4.
    }
    onSize(next);
  }
  function changeScheme(face: Face, color: Color) {
    const previousFace = FACES.find(f => targetScheme[f] === color)!;
    setTargetScheme({ ...targetScheme, [face]: color, [previousFace]: targetScheme[face] });
  }
  function rescan() {
    setColors(Array(totalCells).fill(null)); setPhotos({}); setConfirmed([]); setFace('F');
    goCapture();
  }
  function paintCell(index: number) {
    setColors(previous => previous.map((c, i) => i === index ? paint : c));
    const f = FACES[Math.floor(index / cells)];
    setConfirmed(previous => previous.filter(value => value !== f));
    setPhotos(previous => previous[f] ? { ...previous, [f]: { ...previous[f]!, samples: previous[f]!.samples.map((s, i) => i === index % cells ? { ...s, color: paint, confidence: 1 } : s) } } : previous);
  }
  function updatePhoto(photo: Photo, source?: Photo) {
    if (source && (latestDraft.current.photos[face] !== source || latestDraft.current.page !== 'capture')) return;
    setPhotos(previous => ({ ...previous, [face]: photo }));
    const start = FACES.indexOf(face) * cells;
    setColors(previous => previous.map((c, i) => i >= start && i < start + cells ? photo.samples[i - start]?.color ?? null : c));
    setConfirmed(previous => previous.filter(f => f !== face));
  }
  function confirmFace() {
    const next = Array.from(new Set([...confirmed, face]));
    setConfirmed(next);
    const remaining = CAPTURE_ORDER.find(f => !next.includes(f));
    if (remaining) setFace(remaining); else setPage('review');
  }
  function calibrate() {
    setError('');
    if (FACES.some(f => !photos[f]?.samples.length) || colors.some(c => !c)) { setError('请先完成六张照片的识别，再检查六个中心格的颜色。'); return; }
    try {
      normalizeColors(colors as Color[]);
      const palette = Object.fromEntries(FACES.map((f, i) => [colors[i * 9 + 4]!, photos[f]!.samples[4].rgb])) as Record<Color, RGB>;
      const next = { ...photos };
      const nextColors = [...colors];
      FACES.forEach((f, fi) => {
        const samples = photos[f]!.samples.map(s => classify(s.rgb, palette));
        next[f] = { ...photos[f]!, samples };
        samples.forEach((s, i) => { nextColors[fi * 9 + i] = s.color; });
      });
      setPhotos(next); setColors(nextColors); setConfirmed([]);
    } catch (e) { setError((e as Error).message); }
  }
  const cancelRotation = useCallback(() => { rotationId.current++; setRotating(false); }, []);
  async function applyOrientation(rotations: FaceRotations) {
    const id = ++rotationId.current;
    setRotating(true); setError('');
    try {
      const nextColors = rotateFaces(colors, rotations);
      const nextPhotos = { ...photos };
      for (const f of FACES) {
        if (rotations[f] && photos[f]) nextPhotos[f] = await transformCapturedPhoto(photos[f]!, false, rotations[f]);
      }
      const latest = latestDraft.current;
      if (id !== rotationId.current || latest.colors !== colors || latest.photos !== photos || latest.page !== page) return;
      setColors(nextColors); setPhotos(nextPhotos);
      // 只改变照片方向，颜色确认仍然有效；无须重新识别或重拍。
    } catch {
      if (id === rotationId.current) setError('调整方向失败，原照片和已校对颜色已保留，请重试。');
    } finally {
      if (id === rotationId.current) setRotating(false);
    }
  }
  const cancelSolve = useCallback(() => {
    activeId.current = ''; worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current); setLoading('');
  }, []);
  function solve(state: string, scheme: Record<Face, Color>, demo: boolean) {
    setError(''); setLoading('正在检查魔方状态…');
    const id = crypto.randomUUID(); activeId.current = id;
    if (timer.current) clearTimeout(timer.current);
    try {
      if (!worker.current) worker.current = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data }) => {
        if (data.id !== activeId.current) return;
        if (data.type === 'progress') { setLoading(data.message); return; }
        if (timer.current) clearTimeout(timer.current);
        setLoading('');
        if (data.type === 'error') { setError(data.message); return; }
        const moves = data.moves as Move[];
        if (applyMoves(state, moves) !== SOLVED) { setError('路线检查未通过，请重新尝试'); return; }
        const startedAt = Date.now(); setNow(startedAt);
        setSession({ version: 1, size, initial: state, scheme, moves, index: 0, startedAt, demo });
        setGuideReady(false); setUndoing(false); setPlayId(0); setPlaying(false);
        setPage(moves.length ? 'guide' : 'complete');
      };
      worker.current.onerror = () => { cancelSolve(); setError('还原引擎加载失败，请检查网络后重试。'); };
      worker.current.postMessage({ id, state });
      const timeout = size === 4 ? 180 : 60;
      timer.current = setTimeout(() => { cancelSolve(); setError(`这次计算超过 ${timeout} 秒，请重试；照片和颜色已保留。`); }, timeout * 1000);
    } catch { cancelSolve(); setError('当前浏览器无法启动还原引擎，请使用新版 Chrome 或 Safari。'); }
  }
  function replay() { setPlaying(true); setPlayId(id => id + 1); }
  function confirmMove() {
    if (!session || playing) return;
    const index = session.index + (undoing ? -1 : 1);
    setSession({ ...session, index, finishedAt: undefined }); setUndoing(false);
    if (index === session.moves.length) { setPage('complete'); setPlaying(false); }
    else replay();
  }
  async function clearData() {
    cancelSolve();
    setColors(Array(totalCells).fill(null)); setPhotos({}); setConfirmed([]); setSession(null); setTargetScheme(DEFAULT_SCHEME);
    try { localStorage.removeItem(STORAGE_KEY); await del(DRAFT_KEY); }
    catch { setStorageWarning('浏览器未允许删除存储，请在浏览器设置中清除此站点的数据。'); }
    setDialog(null); setPage('home'); setFace('F');
  }

  return <div className="app-shell" data-size={size}>
    <header className="site-header">
      <button className="brand" onClick={() => setPage('home')} aria-label="魔方一步通首页"><Logo /></button>
      <nav><button className={page !== 'home' ? 'nav-active' : ''} onClick={goCapture}>还原魔方</button><button onClick={() => setDialog('help')}>使用指南<ArrowUpRight size={13} /></button></nav>
      <span className="version-badge"><span />{size === 4 ? '四阶' : '三阶'}魔方 <b>{size} × {size}</b></span>
    </header>
    {storageWarning && <div className="storage-warning">{storageWarning}</div>}
    {page === 'home' ? <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="tiny-cube"><Sparkles size={14} /></span>你的第一位魔方教练</div>
          <h1>不用背公式。<br />跟着转，<span>就还原。</span></h1>
          <p className="hero-description">拍下魔方的六个面，剩下的交给我们。<br />一步一动画，把手中的混乱转成小小的成就。</p>
          <div className="size-selector" role="group" aria-label="选择魔方阶数">
            {([3, 4] as const).map(value => <button key={value} disabled={!draftReady} aria-pressed={size === value} onClick={() => void switchSize(value)}>
              <Box size={18} /><span>{value === 3 ? '三阶魔方' : '四阶魔方'}<small>{value} × {value} · {value * value * 6} 格</small></span>{size === value && <Check size={16} />}
            </button>)}
          </div>
          <div className="hero-actions">
            <button className="button primary big" onClick={goCapture} disabled={!draftReady}><Camera size={19} />还原我的魔方<ArrowRight size={18} /></button>
            <button className="button secondary big" onClick={() => solve(DEMO_STATE, DEFAULT_SCHEME, true)}><Play size={16} fill="currentColor" />先体验一下</button>
          </div>
          <div className="hero-promises"><span><Check size={14} />零基础也能上手</span><span><LockKeyhole size={13} />照片仅保存在本机</span></div>
          {session && <button className="resume-card" onClick={() => {
            setGuideReady(false); setUndoing(false); setPlayId(0); setPage(session.index === session.moves.length ? 'complete' : 'guide');
          }}><span className="resume-icon"><Clock3 size={18} /></span><span><b>继续上次的{session.demo ? '体验' : '还原'}</b><small>已完成 {session.index} / {session.moves.length} 步</small></span><ArrowRight size={18} /></button>}
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-art-label"><span className="live-dot" />一起解开这一面</div>
          <CubeView state={DEMO_STATE} interactive={false} />
          <div className="float-card float-top"><span className="float-icon blue"><ScanLine size={19} /></span><div><strong>看见每一种颜色</strong><small>六面照片 · 智能识别</small></div><Check size={15} className="text-blue" /></div>
          <div className="float-card float-bottom"><span className="float-icon mint"><CheckCheck size={21} /></span><div><strong>下一步，一目了然</strong><small>3D 动画陪你转到最后</small></div></div>
          <div className="art-dots"><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>
      <section className="how-it-works">
        <div className="section-heading"><div><span className="section-kicker">JUST THREE LITTLE STEPS</span><h2>还原魔方，可以很简单</h2></div><span className="soft-note">不需要经验，只需要一个魔方。</span></div>
        <div className="feature-grid">
          {[{ title: '拍下六个面', text: '跟着方向提示拍照，每一面都不会漏。', icon: Camera, style: 'blue' },
            { title: '确认一下颜色', text: '看一眼识别结果，点点格子就能修正。', icon: ScanLine, style: 'violet' },
            { title: '一步一步跟着转', text: '看动画、转魔方，亲手完成你的第一次还原。', icon: Box, style: 'mint' }].map((item, i) =>
              <div className="feature-card" key={item.title}><span className={`feature-icon ${item.style}`}><item.icon size={23} strokeWidth={1.6} /></span><span className="feature-number">0{i + 1}</span><h3>{item.title}</h3><p>{item.text}</p></div>)}
        </div>
      </section>
      <div className="home-bottom"><span><ShieldCheck size={19} />你的照片只属于你，识别与还原都在本机完成。</span><button onClick={() => setDialog('help')}>第一次玩？看看小提示<ChevronRight size={15} /></button></div>
      {error && <div className="alert" role="alert">{error}</div>}
    </main> : <main className={`workspace workspace-${page}`}>
      <div className="workspace-heading"><button className="back-link" onClick={() => setPage(page === 'review' ? 'capture' : 'home')}><ArrowLeft size={15} />{page === 'review' ? '返回拍照' : '返回首页'}</button><span className="workspace-tag">{session?.demo && (page === 'guide' || page === 'complete') ? '演示体验' : '我的还原之旅'}</span></div>
      <div className="stepper">{steps.map((s, i) => <div key={s.title} className={`step ${i === stepNumber ? 'current' : i < stepNumber ? 'done' : ''}`}><span className="step-circle">{i < stepNumber ? <Check size={16} /> : i + 1}</span><span>{s.label}</span>{i < 2 && <i />}</div>)}</div>

      {page === 'capture' && <>
        <div className="page-title"><div><span className="section-kicker">LET'S MEET YOUR CUBE</span><h1>先认识一下你的魔方</h1><p>选好前面和上面，按顺序拍下六个面。拍摄时只整体转动，别拧任何一层。</p></div><span className="count-badge">{confirmed.length}<small> / 6 面已确认</small></span></div>
        <div className="capture-layout">
          <aside className="panel face-sidebar"><h3>魔方的六个面</h3><div className="face-list">{CAPTURE_ORDER.map((f, i) => {
            const count = colors.slice(FACES.indexOf(f) * cells, (FACES.indexOf(f) + 1) * cells).filter(Boolean).length;
            return <button key={f} className={`face-tab ${face === f ? 'active' : ''}`} onClick={() => { setFace(f); setError(''); }}>
              <span className="face-tab-number">{confirmed.includes(f) ? <Check size={15} /> : `0${i + 1}`}</span><span><b>{FACE_NAMES[f]}</b><small>{confirmed.includes(f) ? '已确认' : count ? `${count} 格已录入` : '等待拍摄'}</small></span><ChevronRight size={15} />
            </button>;
          })}</div><div className="sidebar-tip"><Lightbulb size={18} /><p>先选一个面朝向自己作为“前面”，记住上方相邻的面。拍摄过程中不要拧动魔方。</p></div></aside>
          <section className="panel capture-main"><div className="panel-title"><h2>拍摄{FACE_NAMES[face]}<span>{face}</span></h2><span>第 {CAPTURE_ORDER.indexOf(face) + 1} 面，共 6 面</span></div>
            <PhotoEditor key={face} size={size} face={face} photo={photos[face]} onChange={updatePhoto} />
          </section>
          <aside className="panel color-panel"><span className="section-kicker">COLOR CHECK</span><h3>这一面，颜色对吗？</h3><p>先选颜色，再点格子修正。<br />{size === 4 ? '四阶每面 16 格，没有固定中心。' : '中间的小圆点代表中心块。'}</p>
            <FaceEditor face={face} colors={colors} onPaint={paintCell} large confidence={photos[face]?.samples.map(s => s.confidence)} />
            <Palette selected={paint} onSelect={setPaint} />
            {!!photos[face]?.samples.some(s => s.confidence < .25) && <p className="confidence-note"><CircleHelp size={14} />带问号的格子需要多看一眼</p>}
            <button className="button primary full" onClick={confirmFace} disabled={colors.slice(FACES.indexOf(face) * cells, (FACES.indexOf(face) + 1) * cells).some(c => !c) || (!!photos[face] && !photos[face]?.samples.length)}>
              <Check size={17} />这一面没问题<ArrowRight size={16} /></button>
            {photos[face] && <button className="text-button" onClick={() => setPhotos(previous => { const next = { ...previous }; delete next[face]; return next; })}>改为手动填写这一面</button>}
            <span className="subtle-note">也可以不上传照片，直接填写{size === 4 ? '十六格' : '九宫格'}。</span>
          </aside>
        </div>
        <div className="page-bottom"><span><LockKeyhole size={14} />照片不会离开你的浏览器</span><button className="button secondary" disabled={colors.some(c => !c)} onClick={() => setPage('review')}>查看全部六面<ArrowRight size={16} /></button></div>
      </>}

      {page === 'review' && <>
        <div className="page-title"><div><span className="section-kicker">A QUICK DOUBLE-CHECK</span><h1>再看一眼，就可以出发</h1><p>{size === 4 ? '对照实体核对全部 96 格，每种颜色应有 16 格。四阶没有固定中心，请确认还原后的配色。' : '对照实体魔方核对六面。每种颜色应该有 9 格，中心块决定这一面的颜色。'}</p></div><span className="round-icon violet"><ScanLine size={25} /></span></div>
        {size === 4 && <section className="panel scheme-panel">
          <h3>还原后的六面配色</h3><p>默认白上、绿前、红右。这里指定最终还原位置，不是当前照片颜色。普通魔方通常无需修改；特殊配色请参照同款魔方还原后的颜色排列。改变一个颜色会与原位置互换。</p>
          <div className="scheme-fields">{FACES.map(f => <label key={f}>{FACE_NAMES[f]}<select aria-label={`还原后${FACE_NAMES[f]}颜色`} value={targetScheme[f]} onChange={e => changeScheme(f, e.target.value as Color)}>{COLOR_KEYS.map(c => <option key={c} value={c}>{COLORS[c].name}</option>)}</select></label>)}</div>
        </section>}
        <div className="review-layout">
          <section className="panel review-faces"><div className="panel-title"><h2>六面颜色</h2><span>选择颜色后，点击任意格子修改</span></div><Palette selected={paint} onSelect={setPaint} />
            <p className="helper">格子按正对该面时的方向显示。调整照片方向即可，手里的魔方不要拧动。</p>
            <div className="review-face-grid">{CAPTURE_ORDER.map(f => <div className="review-face" key={f}>
              <div><b>{FACE_NAMES[f]}</b><button onClick={() => { setFace(f); setPage('capture'); }}>查看照片<ChevronRight size={12} /></button></div>
              <FaceDirection face={f} colors={colors} />
              <FaceEditor face={f} colors={colors} onPaint={paintCell} confidence={photos[f]?.samples.map(s => s.confidence)} />
              <div className="face-rotation-tools">
                <button aria-label={`${FACE_NAMES[f]}逆时针旋转90度`} onClick={() => applyOrientation({ [f]: -1 })}><RotateCcw size={14} />左转</button>
                <button aria-label={`${FACE_NAMES[f]}顺时针旋转90度`} onClick={() => applyOrientation({ [f]: 1 })}><RotateCw size={14} />右转</button>
              </div>
            </div>)}</div>
            {size === 3 && FACES.every(f => !!photos[f]?.samples.length) && <button className="text-button calibration" onClick={calibrate}><ScanLine size={15} />用六个中心格的实拍颜色重新识别</button>}
            {validation.errors.length > 0 && <OrientationAssistant key={colors.join(',') + FACES.map(f => targetScheme[f]).join('')} state={validation.state} scheme={validation.scheme} colors={colors} errors={validation.errors} onApply={applyOrientation} />}
          </section>
          <aside className="review-aside"><section className="panel validation-panel"><h3>还原前的小检查</h3><div className="color-counts">{COLOR_KEYS.map(c => {
            const count = colors.filter(v => v === c).length;
            return <div key={c}><span className="color-dot" style={{ background: COLORS[c].hex }} /><span>{COLORS[c].name}</span><b className={count !== cells ? 'text-red' : ''}>{count}<small> / {cells}</small></b>{count === cells && <Check size={14} className="text-green" />}</div>;
          })}</div>
            {validation.errors.length ? <div className="validation-errors" role="alert"><h4>六面还没有拼成可还原的状态</h4>{validation.errors.map(e => <p key={e}>{e}</p>)}<small>确认颜色不等于六面方向已对齐。请使用“检查照片方向”，或按格子上方的提示旋转整面；检查通过后即可开始。</small></div> : <div className="valid-message"><ShieldCheck size={19} /><span><b>状态检查通过</b><small>再与实物核对一下，就可以开始了</small></span></div>}
            {validation.errors.length > 0 && <a className="button secondary full diagnosis-link" href="#photo-orientation-check"><ScanLine size={16} />检查并修正方向</a>}
            <button className="button primary full" disabled={validation.errors.length > 0} onClick={() => solve(validation.state, validation.scheme, false)}>这就是我的魔方<ArrowRight size={17} /></button>
          </section><div className="review-note"><Lightbulb size={18} /><p>拍照期间拧过魔方？请重新拍摄六面，确保记录的是同一个状态。</p></div></aside>
        </div>
      </>}

      {page === 'guide' && session && <>
        <div className="page-title"><div><span className="section-kicker">{undoing ? 'ONE STEP BACK' : 'ONE TURN AT A TIME'}</span><h1>{!guideReady ? '拿对方向，我们就开始' : undoing ? '跟着动画，把上一步转回来' : '别着急，我们一步一步来'}</h1><p>{session.demo ? '这是演示魔方。你可以先熟悉操作，再还原手中的魔方。' : '每转好一步，再点确认。重复看动画不会改变你的进度。'}</p></div><span className="timer"><Clock3 size={16} />{timeLabel}</span></div>
        <div className="guide-layout">
          <section className="panel cube-stage">
            <div className="stage-top"><span className="stage-badge"><span className="live-dot" />{!guideReady ? '准备出发' : undoing ? '正在撤回' : `第 ${session.index + 1} 步`}</span><button className="icon-button" aria-label="查看六面状态" onClick={() => setDialog('check')}><Expand size={18} /></button></div>
            <CubeView state={currentState} scheme={session.scheme} move={guideReady ? currentMove : undefined} playId={playId} slow={slow} onEnd={animationEnd} />
            {size === 4 ? <div className="orientation-chips"><span>保持准备时的前面和上面</span><button className="text-button" onClick={() => setDialog('check')}>核对握法与六面</button></div> : <div className="orientation-chips"><span><i style={{ background: COLORS[session.scheme.F].hex }} />{COLORS[session.scheme.F].name}中心朝向你</span><span><i style={{ background: COLORS[session.scheme.U].hex }} />{COLORS[session.scheme.U].name}中心朝上</span></div>}
            <p className="stage-caption">拖动可查看魔方 · 转动屏幕不会改变实体握法</p>
          </section>
          <aside className={`panel instruction-panel ${guideReady ? 'active-instruction' : ''}`}>
            {!guideReady ? <><span className="instruction-icon"><Hand size={26} /></span><span className="section-kicker">BEFORE WE BEGIN</span><h2>{session.index ? '继续前，先核对一下' : '先把魔方拿对'}</h2><p>{size === 4 ? '四阶没有固定中心。请让眼前的前面和朝上的上面，与下面两张图的每个格子一致。接下来保持这个握法，不整体换方向。' : `让${COLORS[session.scheme.F].name}中心朝向自己，${COLORS[session.scheme.U].name}中心朝上。接下来一直保持这个方向。`}</p>
              <div className="orientation-preview"><div><MiniFace state={currentState} face="F" scheme={session.scheme} /><small>你眼前的前面</small></div><div><MiniFace state={currentState} face="U" scheme={session.scheme} /><small>朝上的上面</small></div></div>
              <p className="helper">请核对每个格子的颜色。若和屏幕不同，重新拍照生成路线。</p>
              <button className="button primary full" onClick={() => { setGuideReady(true); replay(); }}>已对齐，开始第 {session.index + 1} 步<Play size={16} /></button>
              <button className="text-button" onClick={rescan}>状态不同，重新拍照</button>
            </> : description && currentMove && <>
              <div className="instruction-meta"><span>{undoing ? '撤回上一步' : '跟着箭头转一格'}</span><span>{description.angle}</span></div>
              <div className="turn-symbol">{currentMove.face === 'R' || currentMove.face === 'L' ? <span>{description.detail.includes('向上') ? '↑' : '↓'}</span> : currentMove.face === 'U' || currentMove.face === 'D' ? <span>{description.detail.includes('向左') ? '←' : '→'}</span> : <RotateCcw size={49} style={{ transform: currentMove.turns === 1 ? 'scaleX(-1)' : undefined }} />}</div>
              <h2>{description.title}</h2><p className="move-detail">{description.detail}</p>
              <div className="move-tip"><Lightbulb size={17} /><p>{currentMove.width === 2 ? `从${FACE_NAMES[currentMove.face]}数，外侧两层捏在一起转，两层之间不要拧开。其余两层保持不动。${currentMove.face === 'B' || currentMove.face === 'D' ? `可点“正对${FACE_NAMES[currentMove.face]}”观察，操作后恢复原握法。` : ''}` : currentMove.face === 'B' ? '这是背对你的那一层。点“正对后面”观察箭头，操作后恢复前面朝你的握法。' : currentMove.face === 'D' ? '只转最下面一层。可以点“正对下面”查看，转好后恢复原来的握法。' : '只转亮起的这一层，其他层保持不动。整块魔方不用换方向。'}</p></div>
              <div className="play-controls"><button className="button secondary" onClick={replay}><RotateCcw size={16} />再看一次</button><button className={`button secondary ${slow ? 'selected-speed' : ''}`} aria-pressed={slow} onClick={() => { setSlow(v => !v); replay(); }}><Play size={15} />{slow ? '慢速中' : '慢一点'}</button></div>
              <button className="button primary full confirm-move" disabled={playing} onClick={confirmMove}><Check size={18} />{playing ? '先看一下动作…' : undoing ? '我已实际转回' : '我转好了'}{!playing && <ArrowRight size={17} />}</button>
              <button className="text-button" onClick={() => setDialog('undo')}><CircleHelp size={14} />这一步有问题</button>
            </>}
          </aside>
        </div>
        <section className="panel progress-panel"><div><span><Flag size={16} />还原进度</span><b>{session.index}<small> / {session.moves.length} 步</small></b></div><div className="progress-track"><span style={{ width: `${session.index / session.moves.length * 100}%` }} /></div><p>每一个小转动，都离还原更近一点。<span>{Math.round(session.index / session.moves.length * 100)}%</span></p></section>
      </>}

      {page === 'complete' && session && <section className="completion">
        <div className="completion-badge"><Trophy size={28} /></div><span className="section-kicker">LOOK WHAT YOU DID</span><h1>{session.finishedAt ? '看，你也可以！' : '最后，检查一下你的成果'}</h1><p>{session.finishedAt ? '一次一次小小的转动，让所有颜色回到自己的位置。' : '转动整个魔方看看，六个面是不是都已经各自同色？'}</p>
        <CubeView state={SOLVED} scheme={session.scheme} compact />
        <div className="completion-stats"><div><b>{session.moves.length}</b><span>跟转动作</span></div><div><b>{timeLabel}</b><span>本次用时（含暂停）</span></div><div><b>0</b><span>需要记的公式</span></div></div>
        {!session.finishedAt ? <><button className="button primary big" onClick={() => { const finishedAt = Date.now(); setNow(finishedAt); setSession({ ...session, finishedAt }); }}><CheckCheck size={19} />{session.demo ? '体验完成' : '六面同色，确认还原'}</button><button className="text-button" onClick={rescan}>还有颜色没对上，重新拍照</button></> : <div className="completion-actions"><button className="button primary big" onClick={session.demo ? goCapture : rescan}><Camera size={17} />{session.demo ? '还原我的魔方' : '再还原一个'}</button><button className="button secondary big" onClick={() => setPage('home')}>返回首页</button></div>}
        {session.demo && <small className="subtle-note">你完成的是演示体验，可以随时上传实体魔方照片。</small>}
      </section>}
      {error && <div className="alert" role="alert">{error}</div>}
    </main>}
    <footer className="site-footer"><span><Box size={15} />魔方一步通<span className="footer-divider">/</span>让每个第一次，都简单一点。</span><button onClick={() => setDialog('delete')}>清除本机数据</button></footer>

    {rotating && <Modal title="正在调整照片方向" onClose={cancelRotation}><div className="solver-loading"><LoaderCircle className="spin" size={36} /><p role="status">保留已校对颜色，同步调整照片和取景框…</p></div><button className="button secondary full" onClick={cancelRotation}>取消，保留原方向</button></Modal>}
    {loading && <Modal title="正在为你规划还原路线" onClose={cancelSolve}><div className="solver-loading"><LoaderCircle className="spin" size={42} /><p role="status">{loading}</p><small>计算在本机完成。首次使用需要准备查找表，请稍等。</small></div><button className="button secondary full" onClick={cancelSolve}>取消，保留当前状态</button></Modal>}
    {dialog === 'help' && <Modal title="第一次还原，也没关系" onClose={closeDialog}><div className="help-list">
      <div><Camera /><span><b>先拍全，再转动</b><p>选好前面和上面，按提示拍六张照片。拍摄途中只整体换方向，不拧任何一层。</p></span></div>
      <div><ImagePlus /><span><b>让颜色清楚一点</b><p>在均匀光线下拍摄，避开反光。调整四角框后点击识别，颜色有误可以直接点格子修正。</p></span></div>
      <div><Hand /><span><b>保持一样的握法</b><p>{size === 4 ? '四阶没有固定中心，按准备页的两张十六格图核对前面和上面。遇到双层动作，从指定面数，外侧两层一起转。' : '用两个中心颜色记住前面和上面。'}正对后面或下面的屏幕视角只供观察，操作后回到基准握法。</p></span></div>
      <div><Play /><span><b>看懂了，再跟着转</b><p>每步只转一格。可以重播和慢放，实际转好后再点“我转好了”。应用不会自动判断实体动作。</p></span></div>
    </div><button className="button primary full" onClick={closeDialog}>明白了，试试看<ArrowRight size={16} /></button></Modal>}
    {dialog === 'check' && session && <Modal title="核对当前六面状态" onClose={closeDialog}><p className="modal-description">这是已确认到第 {session.index} 步的状态，尚未包含正在演示的动作。请按各面方向逐格核对。</p><CubeNet state={currentState} scheme={session.scheme} /><button className="button primary full" onClick={closeDialog}>状态一致，继续</button><button className="text-button" onClick={() => { closeDialog(); rescan(); }}>不一致，重新拍照</button></Modal>}
    {dialog === 'undo' && session && <Modal title="别着急，可以退一步" onClose={closeDialog}>
      <p className="modal-description">先判断手中的魔方是否真的转动过，再选择对应的操作。</p>
      {session.index > 0 && !undoing && <><button className="recovery-option" onClick={() => {
        setSession({ ...session, index: session.index - 1 }); closeDialog(); replay();
      }}><Undo2 size={20} /><span><b>上一步没转，误点了确认</b><small>仅撤销上一次确认，不要求你转动实物</small></span></button>
        <button className="recovery-option" onClick={() => { setUndoing(true); closeDialog(); replay(); }}><RotateCcw size={20} /><span><b>已经按上一步转了，想退回</b><small>观看逆向动画，实际转回后再确认</small></span></button></>}
      <button className="recovery-option" onClick={() => { closeDialog(); setDialog('check'); }}><ScanLine size={20} /><span><b>不确定现在是什么状态</b><small>查看已确认的六面状态，或重新拍照求解</small></span></button>
      <button className="button secondary full" onClick={() => { closeDialog(); replay(); }}>只是没看清，再看一遍</button>
    </Modal>}
    {dialog === 'delete' && <Modal title={`清除${size === 4 ? '四阶' : '三阶'}魔方的记录？`} onClose={closeDialog}><p className="modal-description">将删除当前阶数的六面照片、颜色草稿和还原进度，另一阶数的记录保留。你可以随时重新拍摄。</p><button className="button danger full" onClick={clearData}>删除照片与进度</button><button className="text-button" onClick={closeDialog}>保留数据</button></Modal>}
  </div>;
}
