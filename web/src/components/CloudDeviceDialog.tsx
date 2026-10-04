import { useEffect, useState, type FormEvent } from "react";
import { listCloudDeviceWorkspaces, mapCloudDeviceProject } from "../api";
import { useTaskboardI18n } from "../i18n";
import type { CloudDevice, Project } from "../types";

interface Props {
  devices: CloudDevice[];
  deviceId: string;
  projects: Project[];
  projectId: string;
  onClose: () => void;
  onSelectDevice: (deviceId: string, workspaces: Record<string, string>) => void;
}

export function CloudDeviceDialog({ devices, deviceId, projects, projectId, onClose, onSelectDevice }: Props) {
  const { text } = useTaskboardI18n();
  const [selectedDevice, setSelectedDevice] = useState(deviceId);
  const [selectedProject, setSelectedProject] = useState(projectId);
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({});
  const [workspacePath, setWorkspacePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDevice) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void listCloudDeviceWorkspaces(selectedDevice, controller.signal).then(paths => {
      setWorkspaces(paths);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedDevice]);

  useEffect(() => { setWorkspacePath(workspaces[selectedProject] ?? ""); }, [workspaces, selectedProject]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (workspacePath.trim()) {
        await mapCloudDeviceProject(selectedDevice, selectedProject, workspacePath.trim());
      }
      const paths = await listCloudDeviceWorkspaces(selectedDevice);
      onSelectDevice(selectedDevice, paths);
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  return (
    <div className="delete-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="delete-dialog project-create-dialog cloud-device-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-device-title" onSubmit={event => void save(event)}
        onKeyDown={event => { if (event.key === "Escape" && !saving) onClose(); }}>
        <h2 id="cloud-device-title">{text("当前设备与项目目录", "This device and project folders")}</h2>
        <p>{text("选择正在使用的这台设备。项目目录按设备保存到云端，打开对话时使用所选设备的目录。", "Choose the computer you are using. Project folders are saved per device and used when opening a conversation.")}</p>
        {devices.length === 0 ? <p>{text("请先让 Codex 使用 manage-taskboard 技能登录此云端看板并注册设备。", "Use the manage-taskboard skill in Codex to sign in and register this computer first.")}</p> : <>
          <label><span>{text("当前设备", "Current device")}</span>
            <select autoFocus required value={selectedDevice} onChange={event => setSelectedDevice(event.target.value)} disabled={saving}>
              <option value="">{text("选择这台设备…", "Choose this computer…")}</option>
              {devices.map(device => <option key={device.id} value={device.id}>{device.name} ({device.platform})</option>)}
            </select>
          </label>
          <label><span>{text("项目", "Project")}</span>
            <select required value={selectedProject} onChange={event => setSelectedProject(event.target.value)} disabled={saving}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label><span>{text("这台设备的项目目录", "Project folder on this computer")}</span>
            <input value={workspacePath} onChange={event => setWorkspacePath(event.target.value)} placeholder="/Users/your-name/code/project" maxLength={4096} disabled={loading || saving || !selectedDevice} />
          </label>
          <p>{loading ? text("正在读取目录…", "Loading folders…") : text("填写已有仓库的完整路径；留空可只选择设备。", "Enter the full path of an existing checkout; leave blank to select only the device.")}</p>
        </>}
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <div>
          <button className="button secondary" type="button" onClick={onClose} disabled={saving}>{text("关闭", "Close")}</button>
          {devices.length > 0 && <button className="button primary" type="submit" disabled={!selectedDevice || loading || saving}>{saving ? text("保存中…", "Saving…") : text("保存并使用此设备", "Save and use this device")}</button>}
        </div>
      </form>
    </div>
  );
}
