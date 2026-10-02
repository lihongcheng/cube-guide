import { findOrientations } from './domain/orientation';

self.onmessage = ({ data }: MessageEvent<{ state: string }>) => {
  try {
    self.postMessage({ candidates: findOrientations(data.state) });
  } catch {
    self.postMessage({ error: '方向检查失败，请重试，或使用每面的旋转按钮手动调整。' });
  }
};
