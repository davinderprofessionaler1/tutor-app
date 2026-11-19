const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const outputDirectory = path.resolve(".qa/site");
fs.mkdirSync(outputDirectory, { recursive: true });

const scenarios = [
  { name: "web-home-desktop", url: "http://127.0.0.1:3000", viewport: { width: 1440, height: 1000 } },
  { name: "web-courses-desktop", url: "http://127.0.0.1:3000/courses", viewport: { width: 1440, height: 1000 } },
  { name: "web-course-detail-desktop", url: "http://127.0.0.1:3000/courses/product-thinking-foundations", viewport: { width: 1440, height: 1000 } },
  { name: "web-home-mobile", url: "http://127.0.0.1:3000", viewport: { width: 390, height: 844 } },
  { name: "web-course-detail-mobile", url: "http://127.0.0.1:3000/courses/product-thinking-foundations", viewport: { width: 390, height: 844 } },
  { name: "admin-dashboard-desktop", url: "http://127.0.0.1:3001", viewport: { width: 1440, height: 1000 } },
  { name: "admin-courses-desktop", url: "http://127.0.0.1:3001/courses", viewport: { width: 1440, height: 1000 } },
  { name: "admin-students-desktop", url: "http://127.0.0.1:3001/students", viewport: { width: 1440, height: 1000 } },
  { name: "admin-settings-mobile", url: "http://127.0.0.1:3001/settings", viewport: { width: 390, height: 844 } },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const results = [];

  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

    const response = await page.goto(scenario.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    const measurements = await page.evaluate(() => ({
      title: document.title,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      headings: document.querySelectorAll("h1, h2").length,
      mainTextLength: document.body.innerText.trim().length,
    }));
    const screenshotPath = path.join(outputDirectory, `${scenario.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    if (scenario.name === "web-courses-desktop") {
      await page.locator(".search-field input").fill("leadership");
      await page.waitForTimeout(100);
      const filteredCards = await page.locator(".course-card").count();
      if (filteredCards !== 1) errors.push(`interaction: expected 1 filtered course, found ${filteredCards}`);
    }
    const overflow = measurements.scrollWidth > measurements.viewportWidth + 1;

    results.push({
      ...scenario,
      status: response?.status(),
      screenshotPath,
      overflow,
      errors,
      ...measurements,
    });
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.status !== 200 || result.overflow || result.errors.length || result.headings === 0 || result.mainTextLength < 100)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
