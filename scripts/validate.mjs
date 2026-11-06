/**
 * Валидация модуля для CI:
 *  - module.json парсится и содержит обязательные поля;
 *  - все файлы, указанные в esmodules/styles/languages, существуют;
 *  - lang/*.json парсятся, ключи во всех локалях совпадают с английской.
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

function ok(msg) {
  console.log(`ok: ${msg}`);
}

/* ------------------------------ module.json ----------------------------- */

const moduleJson = JSON.parse(fs.readFileSync("module.json", "utf8"));
const id = moduleJson.id;

if (!id || !/^[a-z0-9-_]+$/i.test(id)) fail(`invalid or missing id: "${id}"`);
else ok(`id = ${id}`);

for (const field of ["title", "version", "compatibility", "esmodules"]) {
  if (moduleJson[field] === undefined) fail(`module.json: missing field "${field}"`);
}
if (moduleJson.compatibility && !moduleJson.compatibility.minimum) {
  fail("module.json: compatibility.minimum is required");
}

// Файлы, на которые ссылается манифест, должны существовать
const referenced = [
  ...(moduleJson.esmodules ?? []),
  ...(moduleJson.styles ?? []),
  ...(moduleJson.languages ?? []).map((l) => l.path),
];
for (const rel of referenced) {
  if (fs.existsSync(rel)) ok(`found ${rel}`);
  else fail(`referenced file not found: ${rel}`);
}

// Шаблоны, к которым обращается код
const templateDir = "templates";
if (fs.existsSync(templateDir)) {
  for (const f of fs.readdirSync(templateDir)) ok(`template: ${path.join(templateDir, f)}`);
} else {
  fail("templates/ directory is missing");
}

/* --------------------------------- lang --------------------------------- */

const langDir = "lang";
const locales = fs.readdirSync(langDir).filter((f) => f.endsWith(".json"));
if (locales.length === 0) fail("no language files in lang/");

const keysOf = (file) =>
  Object.keys(JSON.parse(fs.readFileSync(path.join(langDir, file), "utf8")));

let baseKeys = null;
let baseFile = null;

for (const file of locales) {
  const keys = keysOf(file);
  if (file === "en.json" || baseKeys === null) {
    baseKeys = keys;
    baseFile = file;
  }
  ok(`${file}: ${keys.length} keys`);
}

for (const file of locales) {
  if (file === baseFile) continue;
  const keys = keysOf(file);
  const missing = baseKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !baseKeys.includes(k));
  if (missing.length) fail(`${file}: missing keys: ${missing.join(", ")}`);
  if (extra.length) fail(`${file}: extra keys: ${extra.join(", ")}`);
  if (!missing.length && !extra.length) ok(`${file}: keys match ${baseFile}`);
}

/* --------------------------------- итог --------------------------------- */

if (failures > 0) {
  console.error(`\nValidation failed with ${failures} error(s)`);
  process.exit(1);
}
console.log("\nValidation passed");
