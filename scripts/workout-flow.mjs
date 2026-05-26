import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const errors = [];
  const consoleErrors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/WakeLock|NotAllowedError/.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  // 홈 → 더미 데이터 초기화
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // 루틴 페이지 진입
  await page.goto(BASE + "/routines", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 운동 시작 클릭
  const startBtn = page.locator('a:has-text("운동 시작")').first();
  await startBtn.click();
  await page.waitForURL(/\/workout\//, { timeout: 10000 });
  await page.waitForTimeout(1500);
  console.log("STEP1_운동시작_진입 OK url=", page.url());

  // 첫 세트 완료 버튼 클릭 (체크박스 모양 버튼 — w-10 h-10 rounded-xl)
  const completeButtons = page.locator('button.w-10.h-10.rounded-xl');
  const before = await completeButtons.count();
  console.log("STEP2_완료버튼_개수=", before);

  await completeButtons.first().click();
  await page.waitForTimeout(800);
  console.log("STEP3_첫세트_토글");

  // 휴식 타이머가 시작되어야 함 (text-accent 카운터)
  const timerText = await page.locator('text=/[0-9]+초/').first().textContent().catch(() => null);
  console.log("STEP4_타이머_표시=", timerText);

  // 마무리 모달 → 종료 → 홈 이동까지는 안 하고, 현재 상태가 안정적인지만 확인
  await page.screenshot({ path: "scripts/screens/workout-set-completed.png" });

  // 다음 운동 버튼 클릭
  const nextBtn = page.locator('button:has-text("다음 운동")').first();
  if (await nextBtn.count() > 0) {
    await nextBtn.click();
    await page.waitForTimeout(600);
    console.log("STEP5_다음운동_클릭 OK");
    await page.screenshot({ path: "scripts/screens/workout-next.png" });
  }

  // 이전 운동
  const prevBtn = page.locator('button:has-text("이전")').first();
  if (await prevBtn.count() > 0) {
    await prevBtn.click();
    await page.waitForTimeout(600);
    console.log("STEP6_이전운동_클릭 OK");
  }

  // 뒤로가기
  await page.goBack();
  await page.waitForTimeout(1000);
  console.log("STEP7_뒤로가기 url=", page.url());

  // BottomNavigation에 "진행 중" 배너가 보이는지 확인 (#1 우선순위 검증)
  const banner = await page.locator('text=/진행 중/').count();
  console.log("STEP8_진행중_배너=", banner);
  await page.screenshot({ path: "scripts/screens/after-back.png" });

  console.log("---PAGE_ERRORS---");
  errors.forEach((e) => console.log(e));
  console.log("---CONSOLE_ERRORS_filtered---");
  consoleErrors.forEach((e) => console.log(e));

  await browser.close();
  process.exit(errors.length || consoleErrors.length ? 1 : 0);
})();
