CREATE TABLE cloud_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  taskctl_path TEXT NOT NULL,
  skill_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE cloud_device_projects (
  device_id TEXT NOT NULL REFERENCES cloud_devices(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_path TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (device_id, project_id)
);
