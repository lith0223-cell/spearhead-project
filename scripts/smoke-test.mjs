import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const ROUTES = ["/", "/diet", "/history", "/routines", "/settings"];

const consoleMessages = [];
const pageErrors = [];

async function smokeRoute(page, route) {
  consoleMessages.length = 0;
  pageErrors.length = 0;
  const onConsole = (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      consoleMessages.push(`[${type}] ${msg.text()}`);
    }
  };
  const onPageError = (err) => pageErrors.push(String(err));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
  // 스플래시 사라질 때까지 (최대 4초)
  await page.waitForTimeout(3200);

  const title = await page.title();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const visible = bodyText.length > 0;

  // 스크린샷
  const fname = route === "/" ? "home" : route.replace(/\//g, "");
  await page.screenshot({ path: `scripts/screens/${fname}.png`, fullPage: true });

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return {
    route,
    title,
    visible,
    consoleErrors: consoleMessages.filter((m) => m.startsWith("[error]")).slice(0, 5),
    consoleWarnings: consoleMessages.filter((m) => m.startsWith("[warning]")).slice(0, 3),
    pageErrors: pageErrors.slice(0, 5),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  // -- 1. 기본 라우트 스모크 --
  const results = [];
  for (const route of ROUTES) {
    const r = await smokeRoute(page, route);
    results.push(r);
    console.log(JSON.stringify(r));
  }

  // -- 2. 인터랙션: 식단 페이지에서 FAB 누르고 Drawer 열고 닫기 (ARIA dialog + ESC 검증) --
  const interaction = { steps: [] };
  try {
    await page.goto(BASE + "/diet", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3200);
    interaction.steps.push("진입: /diet");

    // FAB 클릭 — aria-label="식단 추가"
    const fab = page.getByRole("button", { name: "식단 추가" });
    await fab.click({ timeout: 5000 });
    interaction.steps.push("FAB 클릭");

    // Drawer 열림 검증 — role="dialog"
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 3000 });
    const aria = await dialog.getAttribute("aria-modal");
    interaction.steps.push(`Drawer open + aria-modal=${aria}`);
    await page.screenshot({ path: "scripts/screens/diet-drawer-open.png" });

    // ESC로 닫기 검증
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const stillVisible = await dialog.isVisible().catch(() => false);
    interaction.steps.push(`ESC 후 visible=${stillVisible}`);

    // 다시 열어서 백드롭 클릭으로 닫기
    await fab.click({ timeout: 5000 });
    await dialog.waitFor({ state: "visible", timeout: 3000 });
    interaction.steps.push("Drawer 재오픈");

    // body 스크롤 잠금 검증
    const overflow = await page.evaluate(() => document.body.style.overflow);
    interaction.steps.push(`body.overflow=${overflow}`);

    // X 버튼으로 닫기 — aria-label="닫기"
    await page.getByRole("button", { name: "닫기" }).click();
    await page.waitForTimeout(400);
    const closed = !(await dialog.isVisible().catch(() => false));
    interaction.steps.push(`X 클릭 후 닫힘=${closed}`);

    // 닫힌 후 body.overflow 복원
    const restored = await page.evaluate(() => document.body.style.overflow);
    interaction.steps.push(`복원 body.overflow="${restored}"`);
  } catch (e) {
    interaction.error = String(e).slice(0, 300);
  }
  console.log("INTERACTION:", JSON.stringify(interaction));

  // -- 3. 같은 탭 active-workout 이벤트 검증 --
  // localStorage에 active workout을 직접 주입하고 커스텀 이벤트 dispatch → 배너 노출 확인
  const banner = { steps: [] };
  try {
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3200);
    banner.steps.push("진입: /");

    // 루틴이 1개 이상 있다고 가정 (더미 데이터 초기화됨)
    const hasBannerBefore = await page.locator("text=진행 중").count();
    banner.steps.push(`배너 노출 (주입 전)=${hasBannerBefore}`);

    await page.evaluate(() => {
      const data = {
        routineId: "test-routine",
        routineName: "테스트 루틴",
        exercisesData: [{ id: "ex1", name: "벤치", sets: [{ id: "s1", weight: 60, reps: 8, isCompleted: true, restTime: 60 }] }],
        currentExIndex: 0,
        startTime: Date.now() - 5000,
      };
      localStorage.setItem("ph_active_workout", JSON.stringify(data));
      window.dispatchEvent(new Event("ph:active-workout-changed"));
    });
    await page.waitForTimeout(800);
    const hasBannerAfter = await page.locator("text=진행 중").count();
    banner.steps.push(`배너 노출 (주입 후)=${hasBannerAfter}`);

    // 정리
    await page.evaluate(() => {
      localStorage.removeItem("ph_active_workout");
      window.dispatchEvent(new Event("ph:active-workout-changed"));
    });
    await page.waitForTimeout(400);
    const hasBannerAfterClear = await page.locator("text=진행 중").count();
    banner.steps.push(`배너 노출 (정리 후)=${hasBannerAfterClear}`);
  } catch (e) {
    banner.error = String(e).slice(0, 300);
  }
  console.log("BANNER:", JSON.stringify(banner));

  await browser.close();

  // 종합
  const anyConsoleError = results.some((r) => r.consoleErrors.length > 0);
  const anyPageError = results.some((r) => r.pageErrors.length > 0);
  const allVisible = results.every((r) => r.visible);
  console.log(
    "SUMMARY:",
    JSON.stringify({
      allVisible,
      anyConsoleError,
      anyPageError,
      interactionOk: !interaction.error && interaction.steps.length >= 6,
      bannerOk: !banner.error && banner.steps.length >= 4,
    })
  );

  if (!allVisible || anyPageError || interaction.error || banner.error) {
    process.exit(1);
  }
  process.exit(0);
})();
