import { test, expect, type Page } from '@playwright/test';
import { applyMoves, CAPTURE_ORDER, COLORS, DEFAULT_SCHEME, FACES, FACE_NAMES, FOUR_DEMO_STATE, solvedState, toColors, type Face } from '../../src/domain/cube';
import { findOrientations, rotateFaces } from '../../src/domain/orientation';
import { sessionKey, validSession, type Session } from '../../src/domain/session';
import { facePhoto } from './photo-fixture';

async function chooseFour(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /四阶魔方/ }).click();
  await expect(page.getByRole('button', { name: /四阶魔方/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '还原我的魔方', exact: true })).toBeEnabled();
}
async function sessionOf(page: Page): Promise<Session> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey(4));
}
async function confirm(page: Page) {
  const button = page.getByRole('button', { name: '我转好了', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}
async function noWebGL(page: Page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return getContext.apply(this, [type, ...args] as Parameters<typeof getContext>);
    } as typeof getContext;
  });
}
async function waitForGuide(page: Page, timeout = 190_000) {
  const started = Date.now();
  const ready = page.getByRole('button', { name: '已对齐，开始第 1 步' });
  await expect.poll(async () => {
    if (await ready.isVisible()) return 'ready';
    const error = (await page.getByRole('alert').allTextContents()).at(-1);
    return error ? `error: ${error.trim()}` : 'waiting';
  }, { timeout, intervals: [250, 500, 1000], message: '等待四阶求解 Worker 进入握法确认页' }).toBe('ready');
  console.log(`[solver] 四阶握法页就绪：${Date.now() - started} ms`);
}

test('四阶96格照片识别、镜像旋转保留校色、方向候选、真实求解和刷新恢复', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const state = rotateFaces([...FOUR_DEMO_STATE], { U: 1 }).join('');
  await chooseFour(page);
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  for (const face of CAPTURE_ORDER) {
    const offset = FACES.indexOf(face) * 16;
    const photoState = face === 'F' ? state.slice(0, offset) + (state[offset] === 'R' ? 'B' : 'R') + state.slice(offset + 1) : state;
    await page.locator('input[type=file]').first().setInputFiles({ name: `${face}-4.png`, mimeType: 'image/png', buffer: facePhoto(photoState, face) });
    await page.getByRole('button', { name: '识别颜色', exact: true }).click();
    await expect(page.getByRole('button', { name: '这一面没问题' })).toBeEnabled();
    await expect(page.locator('.color-panel .face-editor button')).toHaveCount(16);
    await expect(page.locator('.center-mark')).toHaveCount(0);
    if (face === 'F') {
      await page.getByRole('button', { name: `选择${COLORS[DEFAULT_SCHEME[state[offset] as Face]].name}` }).click();
      await page.locator('.color-panel .face-editor button').first().click();
      for (const name of ['旋转', '旋转', '旋转', '旋转', '镜像', '镜像']) {
        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.getByRole('button', { name: '识别颜色', exact: true })).toBeEnabled();
      }
    }
    for (let i = 0; i < 16; i++) {
      await expect(page.locator('.color-panel .face-editor button').nth(i)).toHaveAttribute('aria-label', `${FACE_NAMES[face]}第${i + 1}格：${COLORS[DEFAULT_SCHEME[state[offset + i] as Face]].name}`);
    }
    await page.getByRole('button', { name: '这一面没问题' }).click();
  }
  await expect(page.getByRole('button', { name: /用六个中心格/ })).toHaveCount(0);
  await expect(page.locator('.color-counts b')).toHaveText(Array(6).fill('16 / 16'));
  const primary = page.getByRole('button', { name: '这就是我的魔方' });
  await expect(primary).toBeDisabled();
  await page.getByRole('button', { name: '检查照片方向', exact: true }).click();
  await expect(page.getByText(/找到 \d+ 种可还原的方向组合/)).toBeVisible();
  const candidates = findOrientations(state);
  const index = candidates.findIndex(c => c.state === FOUR_DEMO_STATE);
  expect(index).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < index; i++) await page.getByRole('button', { name: '下一个', exact: true }).click();
  await page.getByRole('button', { name: '与实物一致，应用此方向' }).click();
  await expect(primary).toBeEnabled();
  await page.screenshot({ path: 'test-results/four-photo-review.png', fullPage: true });
  await primary.click();
  await waitForGuide(page);
  await expect(page.locator('.orientation-preview .mini-face span')).toHaveCount(32);
  await expect(page.locator('.instruction-panel')).toContainText('四阶没有固定中心');
  const session = await sessionOf(page);
  expect(session.initial).toBe(FOUR_DEMO_STATE);
  expect(validSession(session)).toBe(true);
  expect(session.moves.some(m => m.width === 2)).toBe(true);
  await page.screenshot({ path: 'test-results/four-guide-webgl.png', fullPage: true });
  await page.getByRole('button', { name: '已对齐，开始第 1 步' }).click();
  for (let i = 0; i < 3; i++) await confirm(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /四阶魔方/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /继续上次的还原/ }).click();
  await expect(page.getByRole('button', { name: '已对齐，开始第 4 步' })).toBeVisible();
  expect((await sessionOf(page)).index).toBe(3);
  await page.getByRole('button', { name: '查看六面状态' }).click();
  await expect(page.locator('.cube-net .mini-face span')).toHaveCount(96);
  expect(errors).toEqual([]);
});

test('四阶手机CSS双层动画、重播/实际逆转和演示完整通关', async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await noWebGL(page);
  await chooseFour(page);
  await expect(page.locator('.css-cubie-face > div')).toHaveCount(96);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/four-home-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '先体验一下' }).click();
  await waitForGuide(page);
  const session = await sessionOf(page);
  expect(applyMoves(session.initial, session.moves)).toBe(solvedState(4));
  await page.getByRole('button', { name: '已对齐，开始第 1 步' }).click();
  const wideIndex = session.moves.findIndex(m => m.width === 2);
  expect(wideIndex).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < wideIndex; i++) await confirm(page);
  await expect(page.locator('.instruction-panel h2')).toContainText('两层');
  // A 4x4 half-cube includes 28 visible cubies, 48 stickers.
  await expect(page.locator('.css-cube-layer .css-cubie-face > div')).toHaveCount(48);
  await page.getByRole('button', { name: '再看一次', exact: true }).click();
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeEnabled();
  expect((await sessionOf(page)).index).toBe(wideIndex);
  await expect(page.locator('.cube-stage .cube-view')).toBeInViewport({ ratio: .8 });
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/four-wide-mobile.png', fullPage: true });
  await confirm(page);
  await page.getByRole('button', { name: '这一步有问题' }).click();
  await page.getByRole('button', { name: /已经按上一步转了，想退回/ }).click();
  await expect(page.locator('.instruction-panel h2')).toContainText('两层');
  await expect(page.locator('.css-cube-layer .css-cubie-face > div')).toHaveCount(48);
  await page.getByRole('button', { name: '我已实际转回', exact: true }).click();
  expect((await sessionOf(page)).index).toBe(wideIndex);
  for (let i = wideIndex; i < session.moves.length; i++) await confirm(page);
  await expect(page.getByRole('heading', { name: '最后，检查一下你的成果' })).toBeVisible();
  await expect(page.locator('.css-cubie-face > div')).toHaveCount(96);
  await page.getByRole('button', { name: '体验完成', exact: true }).click();
  await expect(page.getByRole('heading', { name: '看，你也可以！' })).toBeVisible();
  await page.screenshot({ path: 'test-results/four-complete-mobile.png', fullPage: true });
  expect((await sessionOf(page)).finishedAt).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('切换阶数即时保存独立草稿，四阶配色及已还原输入可持久化', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  await page.getByRole('button', { name: '选择橙色' }).click();
  await page.locator('.color-panel .face-editor button').first().click();
  await page.getByRole('button', { name: '魔方一步通首页' }).click();
  await page.getByRole('button', { name: /四阶魔方/ }).click();
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  await expect(page.locator('.color-panel .face-editor button.empty')).toHaveCount(16);
  for (const face of CAPTURE_ORDER) {
    await page.locator('input[type=file]').first().setInputFiles({ name: `${face}.png`, mimeType: 'image/png', buffer: facePhoto(solvedState(4), face) });
    await page.getByRole('button', { name: '识别颜色', exact: true }).click();
    await page.getByRole('button', { name: '这一面没问题' }).click();
  }
  await expect(page.getByRole('button', { name: '这就是我的魔方' })).toBeEnabled();
  // Swap the F/B targets, making a mirrored colour scheme. UI must invalidate it.
  await page.getByLabel('还原后前面颜色').selectOption('b');
  await expect(page.getByRole('button', { name: '这就是我的魔方' })).toBeDisabled();
  await page.getByRole('button', { name: '魔方一步通首页' }).click();
  await page.getByRole('button', { name: /三阶魔方/ }).click();
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  await expect(page.locator('.color-panel .face-editor button')).toHaveCount(9);
  await expect(page.locator('.color-panel .face-editor button').first()).toHaveAttribute('aria-label', '前面第1格：橙色');
  await page.getByRole('button', { name: '魔方一步通首页' }).click();
  await page.getByRole('button', { name: /四阶魔方/ }).click();
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  await page.getByRole('button', { name: '查看全部六面' }).click();
  await expect(page.getByLabel('还原后前面颜色')).toHaveValue('b');
  await page.getByLabel('还原后前面颜色').selectOption('g');
  await expect(page.getByRole('button', { name: '这就是我的魔方' })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/four-review-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '这就是我的魔方' }).click();
  await expect(page.getByRole('heading', { name: '最后，检查一下你的成果' })).toBeVisible();
  expect((await sessionOf(page)).moves).toEqual([]);
  expect(toColors((await sessionOf(page)).initial)).toEqual(toColors(solvedState(4)));
});

test('四阶计算可以取消，重新发起仍由真实Worker求解', async ({ page }) => {
  test.setTimeout(240_000);
  await chooseFour(page);
  await page.getByRole('button', { name: '先体验一下' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '取消，保留当前状态' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '先体验一下' })).toBeVisible();
  await page.getByRole('button', { name: '先体验一下' }).click();
  await waitForGuide(page);
  expect(validSession(await sessionOf(page))).toBe(true);
});
