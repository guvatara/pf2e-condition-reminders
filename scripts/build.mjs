/**
 * Сборка модуля: пакует module.json + scripts/styles/templates/lang
 * в dist/<id>.zip и копирует module.json в dist/ для релизных ассетов.
 */
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

const moduleJson = JSON.parse(fs.readFileSync("module.json", "utf8"));
const id = moduleJson.id;

const outDir = "dist";
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const INCLUDE = ["module.json", "scripts", "styles", "templates", "lang", "README.md", "LICENSE"];

const output = fs.createWriteStream(path.join(outDir, `${id}.zip`));
const archive = archiver("zip", { zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
});

archive.pipe(output);

for (const entry of INCLUDE) {
  if (!fs.existsSync(entry)) continue;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) archive.directory(entry, `${id}/${entry}`);
  else archive.file(entry, { name: `${id}/${entry}` });
}

await archive.finalize();
await done;

// module.json рядом с zip — его Foundry использует как manifest в релизе
fs.copyFileSync("module.json", path.join(outDir, "module.json"));

console.log(`Built dist/${id}.zip (${archive.pointer()} bytes), v${moduleJson.version}`);
