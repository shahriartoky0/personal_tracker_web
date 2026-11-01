// Responsive + accessibility smoke check against a running app.
//   node scripts/responsive-check.mjs [baseUrl] [path ...]
// Uses the locally installed Chrome (no browser download). Saves screenshots to docs/screenshots.
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"
import { mkdirSync } from "node:fs"

const base = process.argv[2] ?? "http://localhost:3100"
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/demo", "/login", "/signup"]
const VIEWPORTS = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1440, 900], [1920, 1080],
]
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"
mkdirSync("docs/screenshots", { recursive: true })

const browser = await chromium.launch({ executablePath: chrome })
let problems = 0
for (const path of paths) {
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto(base + path, { waitUntil: "networkidle" })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("a,button,input,select,textarea,[role=radio],[role=checkbox]")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && getComputedStyle(el).visibility !== "hidden" && !el.className?.toString?.().includes("sr-only") })
        .map((el) => `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}`),
    )
    const name = `${path.replace(/\W+/g, "_").replace(/^_/, "") || "home"}-${w}x${h}`
    await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true })
    const flag = overflow > 0 ? `OVERFLOW ${overflow}px` : "ok"
    if (overflow > 0) problems++
    console.log(`${path.padEnd(10)} ${w}x${h}  ${flag}${small.length ? `  small-targets:${small.length} (${small.slice(0, 3).join(", ")})` : ""}`)
    await ctx.close()
  }
  // axe on phone + desktop
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    await page.goto(base + path, { waitUntil: "networkidle" })
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
    for (const v of res.violations) {
      problems++
      console.log(`  AXE ${path} ${w}px [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(" ")}`)
    }
    if (!res.violations.length) console.log(`  axe ${path} ${w}px: no WCAG A/AA violations`)
    await ctx.close()
  }
}
await browser.close()
console.log(problems ? `\n${problems} problem(s) found` : "\nAll checks passed")
process.exit(problems ? 1 : 0)
