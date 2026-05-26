import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  const logs = [];
  const errors = [];
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") logs.push(`[${t}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}\n${err.stack || ""}`));

  // 0. 홈 페이지 거쳐서 더미 데이터 초기화 (initializeDummyData는 홈에서만 호출됨)
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3500);

  // 1. 루틴 페이지 진입 → 더미 루틴 카드 노출 대기
  await page.goto(BASE + "/routines", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "scripts/screens/routines-before.png", fullPage: true });

  // 2. "운동 시작" 버튼 클릭 (첫 번째 루틴)
  const startButtons = await page.locator('a:has-text("운동 시작")').all();
  console.log("START_BUTTON_COUNT:", startButtons.length);

  if (startButtons.length === 0) {
    // 루틴이 없으면 종료
    console.log("NO_ROUTINES — 루틴 자체가 없음");
  } else {
    console.log("CLICKING_FIRST_START");
    await startButtons[0].click({ timeout: 5000 }).catch((e) => console.log("CLICK_ERR:", String(e)));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "scripts/screens/workout-after-click.png", fullPage: true });
    console.log("CURRENT_URL:", page.url());
    const bodyText = await page.locator("body").innerText().catch(() => "");
    console.log("BODY_SAMPLE:", bodyText.slice(0, 400).replace(/\n+/g, " | "));
  }

  console.log("---CONSOLE---");
  logs.forEach((l) => console.log(l));
  console.log("---PAGE_ERRORS---");
  errors.forEach((e) => console.log(e));

  await browser.close();
})();
