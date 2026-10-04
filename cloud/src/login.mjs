import { ApiError } from "../../shared/api-fields.mjs";

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function returnPath(value, origin) {
  const url = new URL(value || "/", origin);
  return url.origin === origin && url.pathname !== "/api/session"
    ? `${url.pathname}${url.search}` : "/";
}

export function loginPage(path, error = "", status = 200) {
  return new Response(`<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>登录 · Taskboard</title><style>
*{box-sizing:border-box}body{margin:0;background:#111113;color:#eee;font:14px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
form{width:100%;max-width:360px;padding:28px;background:#1b1b1e;border:1px solid #333;border-radius:14px}
h1{font-size:23px;margin:0 0 12px}p{color:#aaa;line-height:1.6;font-size:13px;margin:0 0 20px}
label{display:block;margin-top:16px}input{display:block;width:100%;height:40px;margin-top:7px;border:1px solid #48484c;border-radius:6px;background:#111113;color:#eee;padding:0 10px;font:inherit}
input:focus{outline:2px solid #8b5cf6;outline-offset:1px}button{width:100%;height:40px;border:0;border-radius:6px;background:#7c3aed;color:white;font:inherit;margin-top:24px;cursor:pointer}.error{color:#fca5a5;margin-top:16px}
</style></head><body><form method="post" action="/api/session">
<h1>登录 Taskboard</h1><p>使用现有云端看板密码登录，随后选择这台设备和项目目录。</p>
<input type="hidden" name="returnTo" value="${escapeHtml(path)}">
<label>显示名称<input name="username" autocomplete="username" required maxlength="120" autofocus></label>
<label>看板密码<input name="password" type="password" autocomplete="current-password" required maxlength="4096"></label>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
<button type="submit">登录</button></form></body></html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    },
  });
}

export async function loginRequest(request, env, authenticate) {
  const url = new URL(request.url);
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed", { allowed: ["POST"] });
  if (request.headers.get("origin") !== url.origin) throw new ApiError(403, "INVALID_ORIGIN", "Login must use the board's own origin");
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Login requires a form submission");
  }
  const limit = 64 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ApiError(413, "BODY_TOO_LARGE", "Login form is too large");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > limit) throw new ApiError(413, "BODY_TOO_LARGE", "Login form is too large");
  const form = new URLSearchParams(body);
  const username = (form.get("username") ?? "").trim();
  const password = form.get("password") ?? "";
  const redirect = returnPath(form.get("returnTo"), url.origin);
  if (!username || username.includes(":") || username.length > 120 || !password || password.length > 4096) {
    return loginPage(redirect, "请填写有效的显示名称和看板密码。", 400);
  }
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const authentication = await authenticate(new Request(request.url, {
    headers: { authorization: `Basic ${btoa(binary)}` },
  }), env);
  if (!authentication) return loginPage(redirect, "密码不正确，请重新输入。", 401);
  return new Response(null, {
    status: 303,
    headers: { location: redirect, "set-cookie": authentication.sessionCookie, "cache-control": "no-store" },
  });
}
