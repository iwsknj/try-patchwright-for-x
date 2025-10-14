import "dotenv/config";
import { initializeBrowser } from "./util/playwright";

async function main() {
  const authToken = process.env.X_ACCOUNT_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("X_ACCOUNT_AUTH_TOKEN is not set");
  }

  const { browser, context } = await initializeBrowser();

  try {
    const page = await context.newPage();

    console.log("X.comトップにアクセス中...");
    await page.goto("https://x.com/", { waitUntil: "networkidle" });

    console.log("既存のCookieを削除中...");
    await context.clearCookies();

    console.log("auth_token Cookieを設定中...");
    await context.addCookies([
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      },
    ]);

    console.log("ホーム画面へ遷移中...");
    await page.goto("https://x.com/home", { waitUntil: "networkidle" });

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "x_home.png", fullPage: true });
    console.log("ホーム画面のスクリーンショットをx_home.pngに保存しました");
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
