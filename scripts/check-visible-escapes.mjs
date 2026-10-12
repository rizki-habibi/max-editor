import { readFile } from "node:fs/promises";

const app = await readFile("src/App.jsx", "utf8");
const workflow = await readFile(".github/workflows/error-detection.yml", "utf8");
const failures = [];

if (!app.includes("cleanVisibleEscapes")) failures.push("UI sanitizer is missing from src/App.jsx");
// Prevent regression to the original double-escaped AI fallback newline.
if (app.includes(String.raw`errorText+"\\n`)) failures.push("Double-escaped newline found in the AI fallback error message");
if (!app.includes(String.raw`value.trim()==="\\n"`)) failures.push("Sanitizer does not remove a standalone literal \\n text node");
if (!app.includes(String.raw`value.replace(/\\n/g,"\n")`)) failures.push("Sanitizer does not normalize escaped newlines in visible status/chat messages");
if (!workflow.includes("Production HTTP smoke test")) failures.push("Production HTTP smoke test is missing from error-detection workflow");

if (failures.length) {
  console.error("VISIBLE ESCAPE CHECK FAILED:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Visible escape checks passed.");
console.log(" - standalone literal \\n text nodes are removed");
console.log(" - escaped newlines in user-facing messages are normalized");
console.log(" - original AI fallback regression is guarded");
