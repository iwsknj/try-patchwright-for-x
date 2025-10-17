import "dotenv/config";
import { initializeBrowser } from "./util/playwright";
import { chromium } from "patchright";
import { getRandomUserAgent } from "./util/userAgents";

async function main() {
  // const { browser, context } = await initializeBrowser();
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
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
  });

  try {
    const page = await context.newPage();

    await page.goto("https://www.browserscan.net/bot-detection", {
      waitUntil: "networkidle",
    });

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "browser_scan.png", fullPage: true });
    console.log(
      "ブラウザスキャンのスクリーンショットをbrowser_scan.pngに保存しました"
    );
  } catch (err) {
    console.error("エラーが発生しました:", err);
  } finally {
    if (context && process.env.APP_ENV === "production") {
      await context.close();
    }
    if (browser && process.env.APP_ENV === "production") {
      await browser.close();
    }
  }
}

main();
