/**
 * Готовит module.json к релизу из GitHub Actions:
 * подставляет версию из тега и URL манифеста/скачивания конкретного релиза.
 *
 * Использование: node scripts/prepare-release.mjs <tag> <owner/repo>
 * Пример:        node scripts/prepare-release.mjs v1.0.1 guvatara/pf2e-condition-reminders
 */
import fs from "node:fs";

const [tag, repo] = process.argv.slice(2);
if (!tag || !repo) {
  console.error("Usage: node scripts/prepare-release.mjs <tag> <owner/repo>");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const moduleJson = JSON.parse(fs.readFileSync("module.json", "utf8"));

moduleJson.version = version;
moduleJson.manifest = `https://github.com/${repo}/releases/download/${tag}/module.json`;
moduleJson.download = `https://github.com/${repo}/releases/download/${tag}/${moduleJson.id}.zip`;

fs.writeFileSync("module.json", JSON.stringify(moduleJson, null, 2) + "\n");
console.log(`module.json prepared for release ${version}`);
