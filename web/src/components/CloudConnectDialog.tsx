import { useState } from "react";
import { useTaskboardI18n } from "../i18n";

export function CloudConnectDialog({ onClose }: { onClose: () => void }) {
  const { text } = useTaskboardI18n();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = window.location.origin;
  const instruction = text(
    `请读取并安装 ${origin}/skill 提供的 manage-taskboard 技能，连接 ${origin}。使用技能自带的任务工具，完成这台电脑的登录和设备登记；密码由我在私有提示中输入。再查看云端项目，按我提供的真实仓库目录设置这台设备的项目映射。不启动本机面板。安装完成后告诉我如何处理指定任务。`,
    `Read and install the manage-taskboard skill from ${origin}/skill and connect to ${origin}. Use its bundled task tool to sign in and register this computer; I will enter the password at the private prompt. Read the cloud projects and map only the verified checkout folders I supply. Do not start a local panel. Explain how to process specific tasks after installation.`,
  );
  async function copy() {
    try { await navigator.clipboard.writeText(instruction); setCopied(true); setError(null); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }
  return (
    <div className="delete-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="delete-dialog project-create-dialog cloud-device-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-connect-title"
        onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
        <h2 id="cloud-connect-title">{text("连接其他电脑", "Connect another computer")}</h2>
        <p>{text("把下面这段话发给另一台电脑的 Codex。它会安装技能和任务工具，连接同一块云端面板。", "Send this message to Codex on the other computer. It installs the skill and task tool and connects to this cloud board.")}</p>
        <label><span>{text("发给 Codex 的安装说明", "Installation message for Codex")}</span>
          <textarea readOnly rows={7} value={instruction} />
        </label>
        <p><a href={`${origin}/skill`} target="_blank" rel="noreferrer">{origin}/skill</a></p>
        <p>{text("首次连接输入现有看板密码，再设置这台电脑的项目目录。无需克隆看板仓库或打开本机面板；需要 Node.js 20 或更新版本。", "Enter the existing board password once, then set project folders for that computer. No board repository or local panel is needed; Node.js 20+ is required.")}</p>
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <div>
          <button className="button secondary" type="button" onClick={onClose}>{text("关闭", "Close")}</button>
          <button className="button" type="button" onClick={() => void copy()}>{copied ? text("已复制", "Copied") : text("复制安装说明", "Copy installation message")}</button>
        </div>
      </section>
    </div>
  );
}
