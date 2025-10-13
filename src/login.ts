import "dotenv/config";
import { chromium } from "patchright";
import * as fs from "fs";
import { generateOneTimePassword } from "./util/2fa";

async function main() {
  if (
    !process.env.PROXY_SERVER ||
    !process.env.PROXY_USERNAME ||
    !process.env.PROXY_PASSWORD
  ) {
    throw new Error("PROXY_SERVER, PROXY_USERNAME, PROXY_PASSWORD is not set");
  }

  const context = await chromium.launchPersistentContext("./tmp", {
    channel: "chrome",
    headless: false,
    viewport: null,
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

  try {
    // Cookieクリア
    await context.clearCookies();

    const page = await context.newPage();

    console.log("X.comトップにアクセス中...");
    await page.goto("https://x.com/", { waitUntil: "networkidle" });

    // 同一タブ上で x.com のストレージをクリア（プロキシ認証エラー回避のため）
    try {
      await page.evaluate(async () => {
        try {
          localStorage.clear();
        } catch {}
        try {
          sessionStorage.clear();
        } catch {}
        try {
          // Cache Storage をクリア
          // @ts-ignore
          if (typeof caches !== "undefined" && caches?.keys) {
            // @ts-ignore
            const keys = await caches.keys();
            // @ts-ignore
            await Promise.all(keys.map((k: string) => caches.delete(k)));
          }
        } catch {}
      });
      // ストレージクリア後にページを再読込
      await page.reload({ waitUntil: "networkidle" });
    } catch {
      // クリア失敗時は続行
    }

    // ページが完全に読み込まれるまで待機
    await page.waitForTimeout(3000);

    // 人間らしい動作：ページを少し見回す
    await page.mouse.move(100, 100);
    await page.waitForTimeout(500 + Math.random() * 500);
    await page.mouse.move(300, 200);
    await page.waitForTimeout(300 + Math.random() * 300);

    // トップから「ログイン」ボタンをクリックしてログインフローへ
    console.log("トップのログインボタンをクリック中...");
    const topLoginLink = await page.waitForSelector(
      'a[data-testid="loginButton"]',
      {
        timeout: 10000,
      }
    );

    // ボタンにマウスを移動してからクリック
    const loginBox = await topLoginLink.boundingBox();
    if (loginBox) {
      await page.mouse.move(loginBox.x + 50, loginBox.y + 10);
      await page.waitForTimeout(200 + Math.random() * 200);
    }
    await topLoginLink.click();

    // 遷移完了待ち
    await page.waitForLoadState("networkidle");

    // ユーザー名入力フィールドを探して入力
    console.log("ユーザー名を入力中...");
    const usenameInput = await page.waitForSelector('input[name="text"]', {
      timeout: 5000,
    });

    // フォーカスを当ててから自然なタイピング
    await usenameInput.click();
    await page.waitForTimeout(500 + Math.random() * 500); // 人間らしい待機時間

    await usenameInput.type(process.env.X_ACCOUNT_USERNAME || "", {
      delay: 100,
    }); // 自然なタイピング速度

    await page.waitForTimeout(800 + Math.random() * 400); // 入力後の確認時間

    // 「次へ」ボタンをクリック
    console.log("「次へ」ボタンをクリック中...");
    const nextButton = await page.waitForSelector(
      'button[type="button"]:has-text("次へ")',
      { timeout: 5000 }
    );

    // ボタンにマウスを移動してからクリック
    const nextBox = await nextButton.boundingBox();
    if (nextBox) {
      await page.mouse.move(nextBox.x + 30, nextBox.y + 10);
      await page.waitForTimeout(300 + Math.random() * 200);
    }
    await nextButton.click();

    // パスワード入力フィールドが表示されるまで待機
    await page.waitForTimeout(2000);

    // パスワード入力フィールドを探して入力
    console.log("パスワードを入力中...");
    const passwordInput = await page.waitForSelector('input[name="password"]', {
      timeout: 10000,
    });

    // フォーカスを当ててから自然なタイピング
    await passwordInput.click();
    await page.waitForTimeout(300 + Math.random() * 300); // 人間らしい待機時間

    await passwordInput.type(process.env.X_ACCOUNT_PASSWORD || "", {
      delay: 120,
    }); // パスワードは少し遅めに

    // ログインボタンをクリック
    console.log("ログインボタンをクリック中...");
    const loginButton = await page.waitForSelector(
      'button[data-testid="LoginForm_Login_Button"]',
      { timeout: 5000 }
    );

    // ボタンにマウスを移動してからクリック
    const loginBtnBox = await loginButton.boundingBox();
    if (loginBtnBox) {
      await page.mouse.move(loginBtnBox.x + 40, loginBtnBox.y + 15);
      await page.waitForTimeout(400 + Math.random() * 300);
    }
    await loginButton.click();

    // 2FA(TOTP) 入力が求められる場合に対応
    try {
      const otpInput = await page.waitForSelector(
        'input[data-testid="ocfEnterTextTextInput"]',
        { timeout: 5000 }
      );

      const secret = process.env.X_ACCOUNT_2FA_SECRET;
      if (!secret) {
        throw new Error("X_ACCOUNT_2FA_SECRET is not set");
      }

      const otp = generateOneTimePassword(secret);

      // フォーカスを当ててから自然なタイピング
      await otpInput.click();
      await page.waitForTimeout(200 + Math.random() * 200);

      await otpInput.type(otp, { delay: 150 }); // 2FAコードは慎重に入力

      const otpNextButton = await page.waitForSelector(
        'button[data-testid="ocfEnterTextNextButton"]',
        { timeout: 10000 }
      );

      // ボタンにマウスを移動してからクリック
      const otpBox = await otpNextButton.boundingBox();
      if (otpBox) {
        await page.mouse.move(otpBox.x + 35, otpBox.y + 12);
        await page.waitForTimeout(300 + Math.random() * 200);
      }
      await otpNextButton.click();

      await page.waitForTimeout(1000);
    } catch {
      console.log("2FA入力は表示されませんでした。スキップします。");
    }

    // ログインが完了するまで待機（ホームページにリダイレクトされるまで）
    console.log("ログイン完了を待機中...");
    await page.waitForURL("https://x.com", { timeout: 30000 });

    // Cookieを取得
    console.log("Cookieを取得中...");
    const cookies = await context.cookies();

    // CookieをJSON形式でファイルに保存
    const cookieData = JSON.stringify(cookies, null, 2);
    fs.writeFileSync("x_cookies.txt", cookieData);
    console.log("Cookieをx_cookies.txtに保存しました");

    // スクリーンショットを撮影
    await page.screenshot({ path: "x_logged_in.png", fullPage: true });
    console.log(
      "ログイン後のスクリーンショットをx_logged_in.pngに保存しました"
    );
  } catch (err) {
    console.error("エラーが発生しました:", err);
  } finally {
    if (context && process.env.APP_ENV === "production") {
      await context.close();
    }
  }
}

main();
