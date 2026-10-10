/**
 * dsh-liquid-glass-composer —— 宿主半边
 *
 * 本插件是**纯客户端**插件：所有视觉都在浏览器里完成，宿主侧没有工具、
 * 没有服务、没有模型可见内容。这个文件只承担两件事：
 *
 *  1. 让 `dsh.bundle.patch` 指向的 cordis.patch.yml 有一个合法的行目标
 *     （loader 需要一个能名字解析的模块）；
 *  2. 提供一个 `apply()` 出口，符合插件契约，装上即为默认开启。
 *
 * 真正的实现见 `client.js`（以 `dsh.client` bundle 格式由 Web 端加载）。
 */

/** loader 行 id，与 cordis.patch.yml 中的 name 对齐。 */
export const name = 'liquid-glass-composer'

/**
 * 宿主侧不需要任何服务，因此不声明 inject。
 * 这样在纯 CLI 会话、或没有 Web 客户端的 profile 里也能安全装载。
 */
export function apply(ctx) {
  ctx.logger.debug('liquid-glass-composer: 宿主侧无事可做，视觉全部在 Web 客户端（client.js）')
}
