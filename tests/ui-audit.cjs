const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const BASE_URL = "http://127.0.0.1:4173/";
const VIEWPORTS = [320, 375, 640, 768, 1366];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const pageErrors = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  // Read-only audit: never call the live Worker or invoke admin actions.
  await page.route("https://mc-start-control.luismariohernandezsantos.workers.dev/**",
    route => route.abort());
  page.on("pageerror", error => pageErrors.push(error.message));

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.locator("#language-select").waitFor();

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const layout = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll("body *")]
          .filter(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 &&
              style.position !== "fixed" &&
              (rect.left < -1 || rect.right > viewport + 1);
          })
          .slice(0, 8)
          .map(element => ({
            tag: element.tagName.toLowerCase(),
            id: element.id,
            className: typeof element.className === "string" ? element.className : ""
          }));
        return {
          viewport,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          offenders
        };
      });

      if (layout.documentWidth > layout.viewport || layout.bodyWidth > layout.viewport) {
        failures.push("Horizontal overflow at " + width + "px: " + JSON.stringify(layout));
      }
      if (width === 320 || width === 1366) {
        await page.screenshot({ path: "artifacts/ui-" + width + "px.png", fullPage: true });
      }
      console.log("Responsive " + width + "px: " + layout.documentWidth + "px document width");
    }

    // 320px and 640px CSS viewports approximate 400% and 200% zoom reflow checks.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    const firstFocus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return {
        id: element.id,
        href: element.getAttribute("href"),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        visible: !!element.getClientRects().length
      };
    });
    if (firstFocus.href !== "#main-content" || !firstFocus.visible ||
        firstFocus.outlineStyle === "none" || firstFocus.outlineWidth === "0px") {
      failures.push("Skip link/focus indicator check failed: " + JSON.stringify(firstFocus));
    }
    console.log("Keyboard first focus: " + JSON.stringify(firstFocus));
    const focusedControls = new Set();
    for (let index = 0; index < 24; index++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const element = document.activeElement;
        const style = getComputedStyle(element);
        return {
          id: element.id,
          tag: element.tagName.toLowerCase(),
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth
        };
      });
      if (focus.tag === "body") break;
      if (focus.id) focusedControls.add(focus.id);
      if (["a", "button", "input", "select"].includes(focus.tag) &&
          (focus.outlineStyle === "none" || focus.outlineWidth === "0px")) {
        failures.push("Missing visible keyboard focus on " + focus.tag + "#" + focus.id);
      }
    }
    for (const requiredId of [
      "language-select", "access-password", "start-button", "stop-button",
      "status-button", "private-status-button"
    ]) {
      if (!focusedControls.has(requiredId)) {
        failures.push("Keyboard sequence did not reach #" + requiredId);
      }
    }

    const languages = [
      ["pt", "Minecraft Server | O teu servidor", "pt"],
      ["es", "Minecraft Server | Tu servidor", "es"],
      ["en", "Minecraft Server | Your server", "en"]
    ];
    for (const [value, expectedTitle, expectedLang] of languages) {
      await page.locator("#language-select").selectOption(value);
      const actual = await page.evaluate(() => ({
        title: document.title,
        lang: document.documentElement.lang
      }));
      if (actual.title !== expectedTitle || !actual.lang.toLowerCase().startsWith(expectedLang)) {
        failures.push("Language " + value + " mismatch: " + JSON.stringify(actual));
      }
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    const persisted = await page.locator("#language-select").inputValue();
    if (persisted !== "en") failures.push("Language preference did not persist: " + persisted);

    for (const width of [320, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      const results = await new AxeBuilder({ page }).withTags([
        "wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"
      ]).analyze();
      const violations = results.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes.slice(0, 5).map(node => ({
          target: node.target,
          summary: node.failureSummary
        }))
      }));
      if (violations.length) {
        failures.push("axe-core violations at " + width + "px: " + JSON.stringify(violations));
      }
      console.log("axe-core " + width + "px: " + results.passes.length +
        " rules passed, " + violations.length + " violations");
    }

    if (pageErrors.length) failures.push("Browser JavaScript errors: " + JSON.stringify(pageErrors));
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(failures.join("\n\n"));
    process.exitCode = 1;
  } else {
    console.log("Browser UI audit passed.");
  }
}

main().catch(error => {
  // Do not dump page contents, request headers or form values into CI logs.
  console.error("UI audit failed: " + error.message);
  process.exitCode = 1;
});
