#!/usr/bin/env node
import { mkdir, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const origin = new URL(args.shift());
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("Pass the board's HTTPS origin without credentials or a path.");
}
const index = args.indexOf("--dest");
const destination = path.resolve(index >= 0 ? args[index + 1] : path.join(process.env.CODEX_HOME ?? path.join(homedir(), ".codex"), "skills/manage-taskboard"));
const update = args.includes("--update");
try {
  await access(path.join(destination, "SKILL.md"));
  if (!update) throw new Error("This skill already exists. Use --update to update its tools while keeping its private login session.");
} catch (error) { if (error.code !== "ENOENT") throw error; }
const response = await fetch(new URL("/skill/package.json", origin), { redirect: "error" });
if (!response.ok) throw new Error(`Skill download failed: ${response.status}`);
const bundle = await response.json();
const names = ["SKILL.md", "references/cli.md", "cli/taskctl.mjs", "cli/cloud-session.mjs", "server/cloud-config.mjs", "shared/domain.mjs", "shared/api-fields.mjs", "shared/task-input.mjs"];
if (bundle.name !== "manage-taskboard" || Object.keys(bundle.files ?? {}).length !== names.length || names.some(name => typeof bundle.files[name] !== "string")) {
  throw new Error("Invalid Taskboard skill package.");
}
for (const name of names) {
  const target = path.join(destination, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bundle.files[name], { mode: 0o644 });
}
await writeFile(path.join(destination, "board.json"), JSON.stringify({ url: origin.origin }) + "\n");
console.log(`Installed: ${path.join(destination, "SKILL.md")}`);
console.log("The skill is available on your next Codex turn. Node.js 20+ is required; no local panel or npm install is needed.");
console.log(`Connect once: node "${path.join(destination, "cli/taskctl.mjs")}" cloud login --url ${origin.origin} --actor-name YOUR_NAME --device-name YOUR_COMPUTER`);
console.log("Enter the existing board password only at the private Shared key prompt. Login registers this device.");
