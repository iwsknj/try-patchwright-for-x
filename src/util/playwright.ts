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
      // "--blink-settings=imagesEnabled=false",
      "--disable-remote-fonts",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-gpu",
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

  // WebDriver検知の回避: navigator.webdriver を未定義化
  await context.addInitScript({
    content: `
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    `,
  });

  // Canvas / WebGL 指紋対策
  await context.addInitScript({
    content: `
      (function() {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function() {
          const ctx = originalGetContext.apply(this, arguments);
          if (ctx) {
            // fillRect に微小ノイズを加える
            const originalFillRect = ctx.fillRect;
            if (originalFillRect) {
              ctx.fillRect = function(x, y, width, height) {
                const noise = Math.random() * (Math.random() < 0.5 ? 0.8 : 0.3);
                return originalFillRect.call(this, x + noise, y + noise, width, height);
              };
            }

            // fillText に微小ノイズを加える
            const originalFillText = ctx.fillText;
            if (originalFillText) {
              ctx.fillText = function(text, x, y) {
                const noise = Math.random() * (Math.random() < 0.5 ? 0.7 : 0.2);
                return originalFillText.call(this, text, x + noise, y + noise);
              };
            }

            // getImageData のピクセルにランダム微調整
            const originalGetImageData = ctx.getImageData;
            if (originalGetImageData) {
              ctx.getImageData = function(x, y, width, height) {
                const imageData = originalGetImageData.apply(this, arguments);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                  if (Math.random() < 0.02) {
                    data[i] = Math.min(255, data[i] + Math.floor(Math.random() * 5 - 2));
                    data[i + 1] = Math.min(255, data[i + 1] + Math.floor(Math.random() * 5 - 2));
                    data[i + 2] = Math.min(255, data[i + 2] + Math.floor(Math.random() * 5 - 2));
                  }
                }
                return imageData;
              };
            }

            // WebGLフィンガープリントの一部ランダム化
            if (window.WebGLRenderingContext) {
              const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
              if (originalGetParameter) {
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                  // UNMASKED_VENDOR_WEBGL (37445) / UNMASKED_RENDERER_WEBGL (37446)
                  if (parameter === 37446 || parameter === 37445) {
                    return Math.random() < 0.5 ? 'WebGL' : 'OpenGL';
                  }
                  return originalGetParameter.apply(this, arguments);
                };
              }
            }
          }
          return ctx;
        };
      })();
    `,
  });

  return { browser, context };
}
