import { ApiError, assertPlainObject, assertAllowedKeys, stringField, validateProjectId } from "../../shared/api-fields.mjs";

function absolutePath(value, name) {
  const result = stringField(value, name, { required: true, maxLength: 4096 });
  if (result.includes("\0") || !(/^(\/|[A-Za-z]:[\\/]|\\\\)/.test(result))) {
    throw new ApiError(400, "INVALID_DEVICE_PATH", `${name} must be an absolute path`);
  }
  return result;
}

function deviceId(value) {
  if (!/^[a-z0-9-]{16,128}$/i.test(value ?? "")) {
    throw new ApiError(400, "INVALID_DEVICE_ID", "Invalid device id");
  }
  return value;
}

function deviceFromRow(row) {
  return {
    id: row.id, name: row.name, platform: row.platform,
    taskctlPath: row.taskctl_path, skillPath: row.skill_path,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function routeDevices(request, env, url, { json, readJson, methodNotAllowed, requireNoQuery }) {
  const root = url.pathname === "/api/devices";
  const match = url.pathname.match(/^\/api\/devices\/([^/]+)\/projects(?:\/([^/]+))?$/);
  if (!root && !match) return null;
  requireNoQuery(url, "Device routes");
  if (root) {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM cloud_devices ORDER BY name, id").all();
      return json(200, { devices: results.map(deviceFromRow) });
    }
    if (request.method !== "POST") methodNotAllowed(["GET", "POST"]);
    const body = await readJson(request);
    assertPlainObject(body);
    assertAllowedKeys(body, new Set(["id", "name", "platform", "taskctlPath", "skillPath"]));
    const id = deviceId(body.id);
    const name = stringField(body.name, "name", { required: true, maxLength: 120 });
    const platform = stringField(body.platform, "platform", { required: true, maxLength: 32 });
    const taskctlPath = absolutePath(body.taskctlPath, "taskctlPath");
    const skillPath = absolutePath(body.skillPath, "skillPath");
    const timestamp = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO cloud_devices
      (id, name, platform, taskctl_path, skill_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, platform=excluded.platform,
        taskctl_path=excluded.taskctl_path, skill_path=excluded.skill_path, updated_at=excluded.updated_at
    `).bind(id, name, platform, taskctlPath, skillPath, timestamp, timestamp).run();
    const row = await env.DB.prepare("SELECT * FROM cloud_devices WHERE id=?").bind(id).first();
    return json(200, { device: deviceFromRow(row) });
  }
  const id = deviceId(decodeURIComponent(match[1]));
  const device = await env.DB.prepare("SELECT id FROM cloud_devices WHERE id=?").bind(id).first();
  if (!device) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device is not registered");
  if (!match[2]) {
    if (request.method !== "GET") methodNotAllowed(["GET"]);
    const { results } = await env.DB.prepare(
      "SELECT project_id, workspace_path FROM cloud_device_projects WHERE device_id=?",
    ).bind(id).all();
    return json(200, { deviceId: id, workspaces: Object.fromEntries(results.map(row => [row.project_id, row.workspace_path])) });
  }
  if (request.method !== "PUT") methodNotAllowed(["PUT"]);
  const projectId = validateProjectId(decodeURIComponent(match[2]));
  if (!await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first()) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Project does not exist");
  }
  const body = await readJson(request);
  assertPlainObject(body);
  assertAllowedKeys(body, new Set(["workspacePath"]));
  const workspacePath = absolutePath(body.workspacePath, "workspacePath");
  await env.DB.prepare(`INSERT INTO cloud_device_projects (device_id, project_id, workspace_path, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(device_id, project_id)
    DO UPDATE SET workspace_path=excluded.workspace_path, updated_at=excluded.updated_at
  `).bind(id, projectId, workspacePath, new Date().toISOString()).run();
  return json(200, { deviceId: id, projectId, workspacePath });
}
