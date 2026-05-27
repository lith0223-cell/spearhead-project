import { chromium } from "@playwright/test";

const PROD = "https://spearhead-project.vercel.app";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const errs = [];
  const consoleErrs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/WakeLock|NotAllowedError|Failed to load resource/i.test(m.text())) {
      consoleErrs.push(m.text());
    }
  });

  // 1. 홈 진입 (더미 초기화)
  await page.goto(PROD, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3500);
  console.log("STEP1_홈_제목:", await page.title());

  // 2. 운동 시작
  await page.goto(PROD + "/routines", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const startBtn = page.locator('a:has-text("운동 시작")').first();
  await startBtn.click();
  await page.waitForURL(/\/workout\//, { timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log("STEP2_운동시작_url:", page.url());

  // 3. 세트 토글
  const completeButtons = page.locator('button.w-10.h-10.rounded-xl');
  console.log("STEP3_완료버튼_개수:", await completeButtons.count());
  await completeButtons.first().click();
  await page.waitForTimeout(1000);

  // 4. 타이머
  const timerText = await page.locator('text=/[0-9]+초/').first().textContent().catch(() => null);
  console.log("STEP4_타이머:", timerText);

  // 5. 뒤로 → 진행 중 배너 (#1 검증)
  await page.goBack();
  await page.waitForTimeout(1500);
  const banner = await page.locator('text=/진행 중/').count();
  console.log("STEP5_진행중_배너:", banner);

  await page.screenshot({ path: "scripts/screens/prod-after-back.png", fullPage: true });

  console.log("---PAGE_ERRORS---");
  errs.forEach((e) => console.log(e));
  console.log("---CONSOLE_ERRORS---");
  consoleErrs.forEach((e) => console.log(e));

  await browser.close();
  process.exit(errs.length || consoleErrs.length ? 1 : 0);
})();
