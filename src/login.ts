import "dotenv/config";
import * as fs from "fs";
import { generateOneTimePassword } from "./util/2fa";
import {
  humanType,
  humanClick,
  humanMouseMove,
  initializeBrowser,
} from "./util/playwright";

async function main() {
  const { browser, context } = await initializeBrowser();

  try {
    const page = await context.newPage();

    console.log("X.comトップにアクセス中...");
    await page.goto("https://x.com/", { waitUntil: "networkidle" });

    // // 同一タブ上で x.com のストレージをクリア（プロキシ認証エラー回避のため）
    // try {
    //   await page.evaluate(async () => {
    //     try {
    //       localStorage.clear();
    //     } catch {}
    //     try {
    //       sessionStorage.clear();
    //     } catch {}
    //     try {
    //       // Cache Storage をクリア
    //       // @ts-ignore
    //       if (typeof caches !== "undefined" && caches?.keys) {
    //         // @ts-ignore
    //         const keys = await caches.keys();
    //         // @ts-ignore
    //         await Promise.all(keys.map((k: string) => caches.delete(k)));
    //       }
    //     } catch {}
    //   });
    //   // ストレージクリア後にページを再読込
    //   await page.reload({ waitUntil: "networkidle" });
    // } catch {
    //   // クリア失敗時は続行
    // }

    // ページが完全に読み込まれるまで待機
    await page.waitForTimeout(3000);

    // 人間らしい動作：ページを少し見回す
    await humanMouseMove(page, 100, 100);
    await humanMouseMove(page, 300, 200, 300);

    // トップから「ログイン」ボタンをクリックしてログインフローへ
    console.log("トップのログインボタンをクリック中...");
    const topLoginLink = await page.waitForSelector(
      'a[data-testid="loginButton"]',
      {
        timeout: 10000,
      }
    );

    // 人間らしいクリック
    await humanClick(page, topLoginLink, { preDelay: 200, postDelay: 200 });

    // 遷移完了待ち
    await page.waitForLoadState("networkidle");

    // ユーザー名入力フィールドを探して入力
    console.log("ユーザー名を入力中...");
    const usenameInput = await page.waitForSelector('input[name="text"]', {
      timeout: 5000,
    });

    // 人間らしいタイピング
    await humanType(page, usenameInput, process.env.X_ACCOUNT_EMAIL || "", {
      delay: 100,
      preDelay: 500,
      postDelay: 800,
    });

    // 「次へ」ボタンをクリック
    console.log("「次へ」ボタンをクリック中...");
    const nextButton = await page.waitForSelector(
      'button[type="button"]:has-text("次へ")',
      { timeout: 5000 }
    );

    // 人間らしいクリック
    await humanClick(page, nextButton, { preDelay: 300, postDelay: 200 });

    await page.waitForTimeout(2000);

    const errorMessage = page.getByText(
      "Could not log you in now. Please try again later"
    );
    const isErrorVisible = await errorMessage.isVisible();
    if (isErrorVisible) {
      console.error(
        "ログインエラーが発生しました: Could not log you in now. Please try again later"
      );
      if (process.env.APP_ENV === "production") {
        await context.close();
      }
      return;
    }

    // パスワード入力フィールドが表示されるまで待機
    await page.waitForTimeout(2000);

    // パスワード入力フィールドを探して入力
    console.log("パスワードを入力中...");
    const passwordInput = await page.waitForSelector('input[name="password"]', {
      timeout: 10000,
    });

    // 人間らしいタイピング（パスワードは少し遅めに）
    await humanType(page, passwordInput, process.env.X_ACCOUNT_PASSWORD || "", {
      delay: 120,
      preDelay: 300,
      postDelay: 600,
    });

    // ログインボタンをクリック
    console.log("ログインボタンをクリック中...");
    const loginButton = await page.waitForSelector(
      'button[data-testid="LoginForm_Login_Button"]',
      { timeout: 5000 }
    );

    // 人間らしいクリック
    await humanClick(page, loginButton, { preDelay: 400, postDelay: 300 });

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

      // 人間らしいタイピング（2FAコードは慎重に入力）
      await humanType(page, otpInput, otp, {
        delay: 150,
        preDelay: 200,
        postDelay: 400,
      });

      const otpNextButton = await page.waitForSelector(
        'button[data-testid="ocfEnterTextNextButton"]',
        { timeout: 10000 }
      );

      // 人間らしいクリック
      await humanClick(page, otpNextButton, { preDelay: 300, postDelay: 200 });

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
    if (browser && process.env.APP_ENV === "production") {
      await browser.close();
    }
  }
}

main();
