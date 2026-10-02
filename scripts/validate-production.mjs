import { chromium, expect as playwrightExpect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const base = '/cube-guide/';
const root = resolve('dist');
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
  if (!pathname.startsWith(base) || !file.startsWith(root + sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));
const url = `http://127.0.0.1:${server.address().port}${base}`;
await mkdir('test-results/production', { recursive: true });
const ci = !!process.env.CI;
const expect = playwrightExpect.configure({ timeout: ci ? 150_000 : 30_000 });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || (ci ? undefined : 'chrome'),
  args: ci ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
const failedRequests = [];
const rootAssetRequests = [];
const workerResponses = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => failedRequests.push({
  url: request.url(),
  failure: request.failure()?.errorText,
}));
page.on('request', request => {
  const pathname = new URL(request.url()).pathname;
  if (/^\/(?:assets\/|favicon\.svg$)/.test(pathname)) rootAssetRequests.push(pathname);
});
page.on('response', response => {
  const pathname = new URL(response.url()).pathname;
  if (/\/assets\/(?:solver|orientation)\.worker-[^/]+\.js$/.test(pathname)) {
    workerResponses.push({ pathname, status: response.status() });
  }
});

try {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: /不用背公式/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '还原我的魔方', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /三阶魔方/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.includes('/cube-guide/assets/')))).toBe(true);

  await page.getByRole('button', { name: '先体验一下' }).click();
  await expect(page.getByRole('heading', { name: '拿对方向，我们就开始' })).toBeVisible();
  await expect(page.getByRole('button', { name: '已对齐，开始第 1 步' })).toBeEnabled();
  await expect(page.locator('.cube-view')).toBeVisible();
  await page.screenshot({ path: 'test-results/production/pages-demo.png', fullPage: true, animations: 'disabled' });

  const report = {
    date: new Date().toISOString(),
    browser: browser.version(),
    ci,
    base,
    home: true,
    solverDemo: true,
    workerResponses,
    rootAssetRequests,
    failedRequests,
    errors,
  };
  await writeFile('test-results/production/validation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  expect(workerResponses.some(response => response.pathname.includes('/solver.worker-') && response.status === 200)).toBe(true);
  expect(rootAssetRequests).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(errors).toEqual([]);
} catch (error) {
  const diagnostic = {
    message: error.message,
    stack: error.stack,
    url: page.url(),
    rootAssetRequests,
    failedRequests,
    errors,
  };
  await writeFile('test-results/production/failure.json', JSON.stringify(diagnostic, null, 2) + '\n');
  await page.screenshot({ path: 'test-results/production/failure.png', fullPage: true }).catch(() => {});
  if (ci) console.error(`::error title=Static browser validation::${JSON.stringify(diagnostic).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  throw error;
} finally {
  await browser.close();
  server.close();
}
