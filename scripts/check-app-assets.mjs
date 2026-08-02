import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "assets/hero3d.js",
  "assets/vendor/three.module.js",
  "assets/icon.webp",
];

for (const file of requiredFiles) {
  await access(file);
}

const html = await readFile("index.html", "utf8");
const app = await readFile("assets/app.js", "utf8");

const requiredReferences = [
  ["favicon", html.includes("./assets/icon.webp")],
  ["Three.js import map", html.includes("./assets/vendor/three.module.js")],
  ["3D module loader", app.includes('import("./hero3d.js")')],
];

const failures = requiredReferences
  .filter(([, valid]) => !valid)
  .map(([label]) => label);

if (failures.length > 0) {
  console.error(`Missing app asset references: ${failures.join(", ")}`);
  process.exit(1);
}

console.log("Verified favicon, local Three.js runtime, and hero 3D module.");
