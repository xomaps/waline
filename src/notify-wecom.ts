import type { Env } from "./env.js";

// 评论后台地址（worker 自带管理面板）；env.ADMIN_URL 可覆盖
const ADMIN_UI_URL = "https://waline.xomaps.com/ui";

/**
 * 新评论企业微信通知（商务群机器人）。
 * - env.WECOM_WEBHOOK 未配置时静默跳过
 * - fire-and-forget：由调用方放在 executionCtx.waitUntil 中，不阻塞评论响应
 * - 失败仅记日志，不影响评论落库结果
 */
export function notifyWecomNewComment(
	env: Env,
	payload: { nick: string; comment: string; url: string; status: string },
): void {
	const webhook = env.WECOM_WEBHOOK;
	if (!webhook) return;

	const nick = payload.nick || "匿名";
	const pending = payload.status === "waiting";
	const tag = pending ? "待审核" : "已发布";
	// 原文摘要：压平换行，截断 120 字
	const excerpt =
		payload.comment.replace(/\s+/g, " ").trim().slice(0, 120) +
		(payload.comment.length > 120 ? "…" : "");
	// 企微 markdown：链接用 [text](url) 格式
	const content = [
		`**博客新评论**（${tag}）`,
		`>昵称：${nick}`,
		`>页面：[${payload.url}](${payload.url})`,
		`>内容：${excerpt}`,
		pending ? `>[打开评论后台审核](${ADMIN_UI_URL})` : "",
	]
		.filter(Boolean)
		.join("\n");

	const body = JSON.stringify({ msgtype: "markdown", markdown: { content } });

	fetch(webhook, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
	})
		.then(async (resp) => {
			if (!resp.ok) {
				console.error("[Wecom Notify] HTTP " + resp.status);
				return;
			}
			const data = (await resp.json()) as { errcode?: number; errmsg?: string };
			if (data.errcode !== 0) {
				console.error("[Wecom Notify] errcode " + data.errcode + ": " + data.errmsg);
			}
		})
		.catch((err) => console.error("[Wecom Notify Error]", err?.message || err));
}
