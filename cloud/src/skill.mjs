const publicPaths = new Set(["/skill", "/skill/", "/skill/SKILL.md", "/skill/package.json", "/skill/install.mjs"]);

export async function cloudSkillResponse(request, env) {
  const url = new URL(request.url);
  if (!publicPaths.has(url.pathname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  const assetUrl = new URL(request.url);
  assetUrl.pathname = url.pathname === "/skill/install.mjs" ? "/skill/install.mjs" : "/skill/package.json";
  assetUrl.search = "";
  const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!asset.ok) return new Response("Skill package unavailable", { status: 503 });
  if (url.pathname === "/skill/install.mjs") return new Response(request.method === "HEAD" ? null : asset.body, {
    headers: { "content-type": "text/javascript; charset=utf-8", "content-disposition": 'attachment; filename="install-taskboard.mjs"', "cache-control": "no-store" },
  });
  const bundle = await asset.json();
  const skill = bundle.files["SKILL.md"];
  const frontmatterEnd = skill.indexOf("\n---", 4) + 4;
  const connection = `\n\n## Install and connect this cloud board\n\nBoard: ${url.origin}\n\nWhen asked to install this skill, download ${url.origin}/skill/install.mjs to a temporary local file, read it, then run \`node INSTALLER_FILE ${url.origin}\`. It installs into the configured Codex skills directory with the bundled CLI; Node.js 20+ is required. No repository clone, npm dependencies, local panel, or companion is needed. For an existing installation, inspect it and use the installer's explicit \`--update\` option only when the user asked to update it; private login sessions are retained.\n\nAfter installation, use \`node SKILL_DIRECTORY/cli/taskctl.mjs cloud status --json\`. If unauthenticated or its remoteUrl differs from this board, run \`node SKILL_DIRECTORY/cli/taskctl.mjs cloud login --url ${url.origin} --actor-name DISPLAY_NAME --device-name COMPUTER_NAME\`. Let the user enter the board password through the private prompt, never chat or command arguments. Login registers this machine and returns its device-selected board URL. Read projects and register only a verified local checkout using \`project map PROJECT_ID --workspace-path ABSOLUTE_PATH\`. Then process only the user-authorized tasks using the workflow below.\n`;
  bundle.files["SKILL.md"] = skill.slice(0, frontmatterEnd) + connection + skill.slice(frontmatterEnd);
  const manifest = url.pathname === "/skill/package.json";
  return new Response(request.method === "HEAD" ? null : manifest ? JSON.stringify(bundle) : bundle.files["SKILL.md"], {
    headers: { "content-type": manifest ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8", "cache-control": "no-store" },
  });
}
