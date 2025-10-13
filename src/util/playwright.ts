import {
  chromium,
  Page,
  ElementHandle,
  Browser,
  BrowserContext,
} from "patchright";
import { getRandomUserAgent } from "./userAgents";

// 人間らしい動作のためのヘルパー関数
export async function humanType(
  page: Page,
  element: ElementHandle<SVGElement | HTMLElement>,
  text: string,
  options?: { delay?: number; preDelay?: number; postDelay?: number }
) {
  const { delay = 100, preDelay = 500, postDelay = 800 } = options || {};

  // フォーカスを当てる
  await element.click();
  await page.waitForTimeout(preDelay + Math.random() * preDelay);

  // 自然なタイピング
  await element.type(text, { delay });

  // 入力後の確認時間
  await page.waitForTimeout(postDelay + Math.random() * (postDelay / 2));
}

export async function humanClick(
  page: Page,
  element: ElementHandle<SVGElement | HTMLElement>,
  options?: { preDelay?: number; postDelay?: number }
) {
  const { preDelay = 300, postDelay = 200 } = options || {};

  // ボタンにマウスを移動
  const box = await element.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 30, box.y + 10);
    await page.waitForTimeout(preDelay + Math.random() * preDelay);
  }

  // クリック
  await element.click();

  // クリック後の待機
  await page.waitForTimeout(postDelay + Math.random() * postDelay);
}

export async function humanMouseMove(
  page: Page,
  x: number,
  y: number,
  delay?: number
) {
  await page.mouse.move(x, y);
  await page.waitForTimeout((delay || 500) + Math.random() * (delay || 500));
}

// ブラウザとコンテキストの初期化関数
export async function initializeBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  if (
    !process.env.PROXY_SERVER ||
    !process.env.PROXY_USERNAME ||
    !process.env.PROXY_PASSWORD
  ) {
    throw new Error("PROXY_SERVER, PROXY_USERNAME, PROXY_PASSWORD is not set");
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: [
      "--blink-settings=imagesEnabled=false",
      "--disable-remote-fonts",
      "--disable-blink-features=AutomationControlled",
    ],
    // プロキシ設定
    proxy: {
      server: process.env.PROXY_SERVER || "", // プロキシサーバーのURL
      username: process.env.PROXY_USERNAME || "", // プロキシ認証のユーザー名（オプション）
      password: process.env.PROXY_PASSWORD || "", // プロキシ認証のパスワード（オプション）
    },
  });

  const userAgent = getRandomUserAgent();
  const context = await browser.newContext({ userAgent });

  return { browser, context };
}
