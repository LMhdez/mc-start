const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const BASE_URL = "http://127.0.0.1:4173/";
const VIEWPORTS = [320, 375, 640, 768, 1366];

let mockedPublicStatus = {
  vm: "VM deallocated",
  docker: "inactive",
  container: "unknown",
  port_open: null,
  rcon_ready: false,
  geyser_ready: false,
  geyser_udp_ready: false,
  players: 0,
  checked_at: "2026-11-01T12:00:00.000Z"
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const pageErrors = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  // Read-only audit: never call the live Worker or invoke admin actions.
  await page.route("https://mc-start-control.luismariohernandezsantos.workers.dev/**", route => {
    if (new URL(route.request().url()).pathname === "/api/public/status") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, result: mockedPublicStatus })
      });
    }
    return route.abort();
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.locator("#language-select").waitFor();

    // The status panel must use exactly the same player-facing vocabulary
    // for Java and Bedrock. These responses are fully mocked; the live Worker
    // is never contacted and no credentials or admin actions are involved.
    const statusCases = [
      {
        name: "Bedrock reachable",
        result: {
          vm: "VM running", docker: "active", container: "running",
          port_open: true, rcon_ready: true,
          geyser_ready: true, geyser_udp_ready: true, players: 0
        },
        expected: "Acessível"
      },
      {
        name: "Bedrock unreachable while Java is reachable",
        result: {
          vm: "VM running", docker: "active", container: "running",
          port_open: true, rcon_ready: true,
          geyser_ready: true, geyser_udp_ready: false, players: 0
        },
        expected: "Inacessível"
      },
      {
        name: "VM deallocated",
        result: {
          vm: "VM deallocated", docker: "inactive", container: "unknown",
          port_open: null, rcon_ready: false,
          geyser_ready: false, geyser_udp_ready: false, players: 0
        },
        expected: "Inacessível"
      },
      {
        name: "Bedrock status unknown",
        result: {
          vm: "VM running", docker: "active", container: "running",
          port_open: null, rcon_ready: null,
          geyser_ready: null, geyser_udp_ready: null, players: null
        },
        expected: "Desconhecido"
      }
    ];

    for (const testCase of statusCases) {
      mockedPublicStatus = testCase.result;
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("#status-details .status-detail").nth(1).waitFor();
      const detailsText = await page.locator("#status-details").innerText();
      const bedrockRow = await page.locator("#status-details .status-detail").nth(1).innerText();
      const javaRow = await page.locator("#status-details .status-detail").nth(0).innerText();
      if (!bedrockRow.includes(testCase.expected)) {
        failures.push(testCase.name + ": expected Bedrock '" + testCase.expected +
          "', got '" + bedrockRow + "'");
      }
      if (!["Acessível", "Inacessível", "Desconhecido"].some(value => javaRow.includes(value))) {
        failures.push(testCase.name + ": Java did not use the shared status vocabulary: " + javaRow);
      }
      if (/Geyser|UDP|RakNet|19132|socket/i.test(detailsText)) {
        failures.push(testCase.name + ": technical diagnostics leaked into player-facing status");
      }
      console.log(testCase.name + ": Java [" + javaRow + "], Bedrock [" + bedrockRow + "]");
    }

    // Restore the deallocated baseline before the remaining visual/accessibility audit.
    mockedPublicStatus = {
      vm: "VM deallocated", docker: "inactive", container: "unknown",
      port_open: null, rcon_ready: false,
      geyser_ready: false, geyser_udp_ready: false, players: 0,
      checked_at: "2026-11-01T12:00:00.000Z"
    };
    await page.reload({ waitUntil: "domcontentloaded" });

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

    // Use a deliberately fake local value so password-gated controls become
    // keyboard-focusable. No buttons are clicked and all Worker requests are
    // blocked above, so this cannot invoke a real administrative action.
    await page.locator("#access-password").fill("audit-only-not-a-real-password");
    // Start from the password field, then move backwards once to include
    // the language selector before traversing the complete sequence forwards.
    await page.keyboard.press("Shift+Tab");
    const previousFocus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return {
        id: element.id,
        tag: element.tagName.toLowerCase(),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth
      };
    });
    if (previousFocus.id !== "language-select" ||
        previousFocus.outlineStyle === "none" || previousFocus.outlineWidth === "0px") {
      failures.push("Keyboard reverse traversal did not reach language selector: " +
        JSON.stringify(previousFocus));
    }

    const focusedControls = new Set(previousFocus.id ? [previousFocus.id] : []);
    for (let index = 0; index < 40; index++) {
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
      "language-select", "access-password", "start-button",
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
