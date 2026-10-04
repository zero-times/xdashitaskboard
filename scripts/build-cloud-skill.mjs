import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "dist/web/skill");
const sources = {
  "SKILL.md": "skills/manage-taskboard/SKILL.md",
  "references/cli.md": "skills/manage-taskboard/references/cli.md",
  "cli/taskctl.mjs": "cli/taskctl.mjs",
  "cli/cloud-session.mjs": "cli/cloud-session.mjs",
  "server/cloud-config.mjs": "server/cloud-config.mjs",
  "shared/domain.mjs": "shared/domain.mjs",
  "shared/api-fields.mjs": "shared/api-fields.mjs",
  "shared/task-input.mjs": "shared/task-input.mjs",
};
const files = {};
for (const [name, source] of Object.entries(sources)) files[name] = await readFile(path.join(root, source), "utf8");
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, "package.json"), JSON.stringify({ name: "manage-taskboard", files }));
await copyFile(path.join(root, "scripts/install-cloud-skill.mjs"), path.join(destination, "install.mjs"));
console.log("Built cloud skill package (8 source files, no credentials or task data)");
