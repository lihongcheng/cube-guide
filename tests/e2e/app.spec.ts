import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { applyMove, CAPTURE_ORDER, COLORS, DEFAULT_SCHEME, DEMO_STATE, FACES, FACE_NAMES, SOLVED, toColors, type Color, type Face } from '../../src/domain/cube';
import { findOrientations, rotateFaces, rotateGrid } from '../../src/domain/orientation';
import type { Photo } from '../../src/domain/vision';
import { facePhoto } from './photo-fixture';

async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '先体验一下' }).click();
  await expect(page.getByRole('heading', { name: '拿对方向，我们就开始' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: '已对齐，开始第 1 步' }).click();
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeEnabled();
}
async function confirm(page: Page) {
  const button = page.getByRole('button', { name: '我转好了', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}
test('真实 Worker 求解、3D 播放、重播不推进、完整通关', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '还原我的魔方', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await demo(page);
  await expect(page.locator('.progress-panel b')).toContainText('0 /');
  await page.getByRole('button', { name: '再看一次', exact: true }).click();
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeEnabled();
  await expect(page.locator('.progress-panel b')).toContainText('0 /');
  await page.screenshot({ path: 'test-results/guide-desktop.png', fullPage: true });
  const total = Number((await page.locator('.progress-panel small').innerText()).match(/\d+/)?.[0]);
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThan(60);
  for (let step = 0; step < total; step++) await confirm(page);
  await expect(page.getByRole('heading', { name: '最后，检查一下你的成果' })).toBeVisible();
  await page.getByRole('button', { name: '体验完成', exact: true }).click();
  await expect(page.getByRole('heading', { name: '看，你也可以！' })).toBeVisible();
  await page.screenshot({ path: 'test-results/complete-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('刷新恢复、误确认撤回和实际逆转分别处理', async ({ page }) => {
  await demo(page);
  for (let i = 0; i < 3; i++) await confirm(page);
  await expect(page.locator('.progress-panel b')).toContainText('3 /');
  await page.reload();
  await page.getByRole('button', { name: /继续上次的体验/ }).click();
  await expect(page.getByRole('button', { name: '已对齐，开始第 4 步' })).toBeVisible();
  await page.getByRole('button', { name: '已对齐，开始第 4 步' }).click();
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '这一步有问题' }).click();
  await page.getByRole('button', { name: /上一步没转，误点了确认/ }).click();
  await expect(page.locator('.progress-panel b')).toContainText('2 /');
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '这一步有问题' }).click();
  await page.getByRole('button', { name: /已经按上一步转了，想退回/ }).click();
  await expect(page.locator('.progress-panel b')).toContainText('2 /');
  await page.getByRole('button', { name: '我已实际转回', exact: true }).click();
  await expect(page.locator('.progress-panel b')).toContainText('1 /');
});

test('六张非对称合成照片上传、识别、人工校正、有效性与求解', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  for (const face of CAPTURE_ORDER) {
    await expect(page.locator('.capture-main h2')).toContainText(`拍摄${FACE_NAMES[face]}`);
    await page.locator('input[type=file]').first().setInputFiles({ name: `${face}.png`, mimeType: 'image/png', buffer: facePhoto(DEMO_STATE, face) });
    await page.getByRole('button', { name: '识别颜色', exact: true }).click();
    const start = FACES.indexOf(face) * 9;
    for (let cell = 0; cell < 9; cell++) {
      const expected = COLORS[DEFAULT_SCHEME[DEMO_STATE[start + cell] as keyof typeof DEFAULT_SCHEME]].name;
      await expect(page.locator('.color-panel .face-editor button').nth(cell)).toHaveAttribute('aria-label', `${FACE_NAMES[face]}第${cell + 1}格：${expected}`);
    }
    await page.getByRole('button', { name: '这一面没问题' }).click();
  }
  await expect(page.getByText('状态检查通过', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/photo-review.png', fullPage: true });
  // 故意改错一个格子，确保校验确实阻止求解；然后恢复原色。
  const original = DEFAULT_SCHEME[DEMO_STATE[18] as keyof typeof DEFAULT_SCHEME];
  const wrong = original === 'r' ? 'b' : 'r';
  await page.getByRole('button', { name: `选择${COLORS[wrong].name}` }).click();
  await page.locator('.review-face').first().locator('.face-editor button').first().click();
  await expect(page.getByRole('button', { name: '这就是我的魔方' })).toBeDisabled();
  await page.getByRole('button', { name: `选择${COLORS[original].name}` }).click();
  await page.locator('.review-face').first().locator('.face-editor button').first().click();
  await expect(page.getByRole('button', { name: '这就是我的魔方' })).toBeEnabled();
  await page.getByRole('button', { name: '这就是我的魔方' }).click();
  await expect(page.getByRole('button', { name: '已对齐，开始第 1 步' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: '状态不同，重新拍照' }).click();
  await expect(page.locator('.count-badge')).toContainText('0');
  await expect(page.locator('.color-panel .face-editor button.empty')).toHaveCount(9);
  await expect(page.locator('.photo-preview img')).toHaveCount(0);
});

test('手机布局、CSS 立体降级与逐步确认', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  // 模拟没有 WebGL 的真实环境，不操作应用状态。
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return getContext.apply(this, [type, ...args] as Parameters<typeof getContext>);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.locator('.css-cube-viewport')).toBeVisible();
  await expect(page.locator('.css-cubie-face > div')).toHaveCount(54);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await demo(page);
  await confirm(page);
  await expect(page.locator('.progress-panel b')).toContainText('1 /');
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeEnabled();
  await expect(page.locator('.cube-stage .cube-view')).toBeInViewport({ ratio: .8 });
  await expect(page.getByRole('button', { name: '我转好了', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/guide-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '魔方一步通首页' }).click();
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  await expect(page.getByRole('heading', { name: '先认识一下你的魔方' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/capture-mobile.png', fullPage: true });
  await context.close();
});

async function readDraft(page: Page) {
  return page.evaluate(() => new Promise<{ colors: Color[]; photos: Partial<Record<Face, Photo>> }>((resolve, reject) => {
    const open = indexedDB.open('keyval-store');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('keyval', 'readonly').objectStore('keyval').get('cube-guide-draft-v1');
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
}
async function enterManually(page: Page, state: string) {
  await page.goto('/');
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  const colors = toColors(state);
  for (const face of CAPTURE_ORDER) {
    for (let i = 0; i < 9; i++) {
      await page.getByRole('button', { name: `选择${COLORS[colors[FACES.indexOf(face) * 9 + i]].name}` }).click();
      await page.locator('.color-panel .face-editor button').nth(i).click();
    }
    await page.getByRole('button', { name: '这一面没问题' }).click();
  }
}

test('六面方向恢复保留实拍取样和手工校色，候选先预览再应用，刷新可继续求解', async ({ page }) => {
  const rotated = rotateFaces([...DEMO_STATE], { U: 1, R: 2, F: 3, D: 1, L: 2, B: 3 }).join('');
  const originalColors = toColors(rotated);
  await page.goto('/');
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  for (const face of CAPTURE_ORDER) {
    // 前面第一格照片故意使用另一种颜色，确保确实保留人工修改。
    const photoState = face === 'F' ? rotated.slice(0, 18) + (rotated[18] === 'R' ? 'B' : 'R') + rotated.slice(19) : rotated;
    await page.locator('input[type=file]').first().setInputFiles({ name: `${face}.png`, mimeType: 'image/png', buffer: facePhoto(photoState, face) });
    await page.getByRole('button', { name: '识别颜色', exact: true }).click();
    await expect(page.getByRole('button', { name: '这一面没问题' })).toBeEnabled();
    if (face === 'F') {
      await page.getByRole('button', { name: `选择${COLORS[originalColors[18]].name}` }).click();
      await page.locator('.color-panel .face-editor button').first().click();
      // 采集页旋转四次，不重新识别也应保留手工色。
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', { name: '旋转', exact: true }).click();
        await expect(page.getByRole('button', { name: '识别颜色', exact: true })).toBeEnabled();
      }
      await expect(page.locator('.color-panel .face-editor button').first()).toHaveAttribute('aria-label', `前面第1格：${COLORS[originalColors[18]].name}`);
    }
    await page.getByRole('button', { name: '这一面没问题' }).click();
  }
  const primary = page.getByRole('button', { name: '这就是我的魔方' });
  await expect(primary).toBeDisabled();
  await expect.poll(async () => (await readDraft(page))?.colors).toEqual(originalColors);
  const before = await readDraft(page);
  await page.getByRole('button', { name: '检查照片方向', exact: true }).click();
  await expect(page.getByText(/找到 \d+ 种可还原的方向组合/)).toBeVisible();
  await expect(primary).toBeDisabled();
  expect((await readDraft(page)).colors).toEqual(originalColors);
  const candidates = findOrientations(rotated);
  const index = candidates.findIndex(c => c.state === DEMO_STATE);
  expect(index).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < index; i++) await page.getByRole('button', { name: '下一个', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/orientation-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '与实物一致，应用此方向' }).click();
  await expect(primary).toBeEnabled();
  await expect.poll(async () => (await readDraft(page)).colors).toEqual(toColors(DEMO_STATE));
  const after = await readDraft(page);
  for (const face of FACES) {
    expect(after.photos[face]!.samples).toEqual(rotateGrid(before.photos[face]!.samples, candidates[index].rotations[face] ?? 0));
    expect(after.photos[face]!.url).toMatch(/^data:image\/png/);
  }
  // 复核页的手动旋转也能往返，颜色/取样均不丢失。
  await page.getByRole('button', { name: '前面顺时针旋转90度' }).click();
  await expect(primary).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '前面逆时针旋转90度' }).click();
  await expect(primary).toBeEnabled();
  await expect.poll(async () => (await readDraft(page)).colors).toEqual(toColors(DEMO_STATE));
  await page.reload();
  await page.getByRole('button', { name: '还原我的魔方', exact: true }).click();
  await page.getByRole('button', { name: '查看全部六面' }).click();
  await expect(primary).toBeEnabled();
  expect((await readDraft(page)).photos.F!.samples).toEqual(after.photos.F!.samples);
  await primary.click();
  await expect(page.getByRole('button', { name: '已对齐，开始第 1 步' })).toBeVisible({ timeout: 60_000 });
});

test('多个合法候选不会擅自应用，修改颜色会废弃旧诊断', async ({ page }) => {
  const state = rotateFaces([...applyMove(SOLVED, { face: 'R', turns: 1 })], { U: 1 }).join('');
  await enterManually(page, state);
  const primary = page.getByRole('button', { name: '这就是我的魔方' });
  await expect(primary).toBeDisabled();
  await page.getByRole('button', { name: '检查照片方向', exact: true }).click();
  await expect(page.getByText(/存在多个候选/)).toBeVisible();
  await page.getByRole('button', { name: '下一个', exact: true }).click();
  await expect(page.locator('.candidate-navigation')).toContainText('候选 2 /');
  await expect(primary).toBeDisabled();
  await page.getByRole('button', { name: '选择黄色' }).click();
  await page.locator('.review-face').first().locator('.face-editor button').first().click();
  await expect(page.getByRole('button', { name: '与实物一致，应用此方向' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '检查照片方向', exact: true })).toBeDisabled();
});

test('精确单角扭转提示：方向检查无解时仍拦截，可导出原始54格；Worker失败可重试', async ({ page }) => {
  const corner = [...SOLVED];
  [corner[8], corner[9], corner[20]] = [corner[9], corner[20], corner[8]];
  const state = corner.join('');
  await enterManually(page, state);
  await expect(page.getByText('角块朝向不一致，请检查角落颜色或照片方向', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '检查并修正方向' }).click();
  await expect(page.getByRole('button', { name: '检查照片方向', exact: true })).toBeInViewport();
  const workerURL = /\/(?:assets\/orientation\.worker-[^/]+\.js|src\/orientation\.worker\.ts)(?:\?|$)/;
  await page.route(workerURL, route => route.abort());
  await page.getByRole('button', { name: '检查照片方向', exact: true }).click();
  await expect(page.getByText('方向检查未能启动，请重试，或用每面的旋转按钮调整。', { exact: true })).toBeVisible();
  await page.unroute(workerURL);
  await page.getByRole('button', { name: '检查照片方向', exact: true }).click();
  await expect(page.getByText(/仅旋转照片无法得到可还原的状态/)).toBeVisible();
  await expect(page.getByRole('button', { name: '这就是我的魔方' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '与实物一致，应用此方向' })).toHaveCount(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出诊断数据' }).click();
  const download = await downloading;
  const diagnostic = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(diagnostic.state).toBe(state);
  expect(diagnostic.orientationCandidateCount).toBe(0);
  expect(Object.values(diagnostic.faces).flat()).toEqual(toColors(state));
  expect(diagnostic).not.toHaveProperty('photos');
  await page.screenshot({ path: 'test-results/orientation-no-candidate.png', fullPage: true });
});
