import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const hydrationErrors = [];
  const allConsoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    allConsoleErrors.push(t);
    if (/hydrat/i.test(t) || /didn't match/i.test(t)) hydrationErrors.push(t);
  });

  // 1) localStorage에 다른 테마를 주입한 상태로 새로고침 → SSR(dark/cyan) vs 클라이언트(light/purple) 강제 충돌
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("ph_mode", "light");
    localStorage.setItem("ph_accent", "purple");
  });

  // 새로고침 → 이 시점이 hydration mismatch가 발생하는 순간
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // <html> 속성 실제로 light/purple로 적용됐는지 확인 (테마 복원 스크립트 정상 동작)
  const htmlAttr = await page.evaluate(() => ({
    mode: document.documentElement.getAttribute("data-mode"),
    accent: document.documentElement.getAttribute("data-accent"),
  }));

  console.log("HTML_ATTR:", JSON.stringify(htmlAttr));
  console.log("HYDRATION_ERRORS:", hydrationErrors.length);
  hydrationErrors.forEach((e) => console.log("  →", e.slice(0, 150)));
  console.log("ALL_CONSOLE_ERRORS:", allConsoleErrors.length);
  allConsoleErrors.forEach((e) => console.log("  -", e.slice(0, 150)));

  await browser.close();
  process.exit(hydrationErrors.length === 0 ? 0 : 1);
})();
