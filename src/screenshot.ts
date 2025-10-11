import { Browser, chromium } from "patchright";

async function main() {
  try {
    const context = await chromium.launchPersistentContext("./tmp", {
      channel: "chrome",
      headless: false,
      viewport: null,
    });

    const page = await context.newPage();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("goto google");
    await page.goto("https://www.google.com", { waitUntil: "networkidle" });
    console.log("screenshot google");
    await page.screenshot({ path: "google.png", fullPage: true });

    await context.close();
  } catch (err) {
    console.error(err);
  }
}

main();
