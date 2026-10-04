import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function cloudSessionPath(env) {
  return env.CODEX_TASKBOARD_CLOUD_CONFIG ?? fileURLToPath(new URL("../.data/cloud-device.json", import.meta.url));
}

export async function readCloudSession(env) {
  try { return JSON.parse(await readFile(cloudSessionPath(env), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function writeCloudSession(env, session) {
  const filename = cloudSessionPath(env);
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(session, null, 2) + "\n", { mode: 0o600 });
  await rename(temporary, filename);
}

export async function clearCloudSession(env) {
  await unlink(cloudSessionPath(env)).catch(error => { if (error.code !== "ENOENT") throw error; });
}

export function cloudTarget(session) {
  return {
    url: session.remoteUrl,
    authorization: `Basic ${Buffer.from(`${session.actorName}:${session.sharedKey}`, "utf8").toString("base64")}`,
  };
}
