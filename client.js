/**
 * dsh-liquid-glass-composer —— 给 DSH Web 输入框铺一层"液态玻璃"
 *
 * 形状：输入框是玻璃；模型思考时，玻璃里往上冒泡。
 *
 * 设计边界（改动前先读这四条）：
 *  1. 玻璃层**只往 slot 里加层**，靠 measure 原生卡片的矩形对齐；不改它的 DOM 结构。
 *     唯一一处会动原生样式的是"真毛玻璃"那一段：给 [data-composer-card] 覆盖
 *     背景与 backdrop-filter（见文件内对应注释，含为什么必须这么做、以及旋钮在哪）。
 *     ★ 如果哪天去掉了那段覆盖，本条要跟着改 —— 文档与实现不符比没有文档更糟。
 *  2. 玻璃里**不放彩色**。Apple 的液态玻璃本身近乎无色，颜色只允许出现在
 *     边缘的高光、顶部镜面、以及外扩散泛光上。
 *  3. 主题过渡：DSH 自己切主题时监听 `theme/change`，只在过渡窗口期给玻璃加
 *     1.7s 的补间（比整页慢）；窗口期外不加 transition，平时交互不受影响。
 *  4. "模型是否在跑"以标准 props 的 `useSession((s) => s.running)` 为准；
 *     拿不到时退化为观察原生按钮（发送↔停止），保证气泡不会因为属性缺失而永远不出现。
 *
 * 以 dsh.client bundle 格式加载（`window.__ModuleLoader__.load`），
 * 与 dsh-expression / dsh-ssh 同款。
 */
window.__ModuleLoader__.load({
  id: 'dsh-liquid-glass-composer',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const STYLE_ID = 'dsh-liquid-glass-composer'
    /** 主题过渡窗口：玻璃 1.7s，留 200ms 余量。 */
    const THEME_WINDOW_MS = 1900

    const CSS = `
/* ============ 挂载层 ============
   定位策略：**不要**用 position:absolute 依赖 slot 容器的定位上下文 ——
   容器若没有 position，绝对定位会一路找到视口，玻璃就横铺满屏。
   改成 fixed + 实测原生输入框的视口矩形，把 x/y/w/h 写进 CSS 变量：
   几何是确定的，也不受父级布局影响；找不到卡片就整体隐藏（fail-closed）。 */
.dsh-lg-root{position:fixed;top:0;left:0;margin:0;padding:0;pointer-events:none;
  width:0;height:0;visibility:hidden}
.dsh-lg-root[data-anchored="1"]{visibility:visible}

.dsh-lg{position:absolute;pointer-events:none;
  left:var(--dsh-lg-x,0px);top:var(--dsh-lg-y,0px);
  width:var(--dsh-lg-w,0px);height:var(--dsh-lg-h,0px);
  border-radius:var(--dsh-lg-radius,20px);
  /* 浅色主题：白玻璃压在白卡上，玻璃里加的全是白 —— 唯一能"看得出有一块玻璃"的三件套：
     ① 冷调发丝边（白底上唯一稳定的边界）② 冷调投影（不是灰黑影，是偏蓝的环境影）
     ③ 卡片外一圈淡蓝环境晕（--dsh-lg-bloom 的浅色值） */
  /* 浅色主题：釉色白 —— **一点蓝都不能有**。
     蓝釉是怎么来的：冷白 tint + 蓝调雾 + 蓝内晕 + 蓝发丝边 + 蓝投影，五处叠在一起就发灰发浑。
     釉色白 = 中性偏亮的白 + 全白的内晕/雾 + 中性灰的边与影。 */
  box-shadow:0 0 0 1px rgba(146,158,178,.15),
             0 2px 6px rgba(24,32,48,.06),
             0 12px 30px rgba(70,82,104,.15),
             0 30px 64px rgba(70,82,104,.09);
  /* 深/浅两套色值，跟随 DSH 的 body[data-ds-dark-theme] */
  --dsh-lg-c1:112,176,244;
  --dsh-lg-c2:150,205,250;
  --dsh-lg-spec:rgba(255,255,255,.95);
  --dsh-lg-bloom-a:.45;
  --dsh-lg-bloom:radial-gradient(62% 150% at 50% 0%,rgba(255,255,255,.50),transparent 72%),
                 radial-gradient(74% 180% at 50% 108%,rgba(158,172,196,.20),transparent 74%);
  /* ⚠ 浅色模式**不许在内容上盖雾**：玻璃层盖在卡片内容之上，白雾一浓就把文字和发送按钮压淡
     （.88 时按钮从实心蓝变淡紫，.42 仍差一档 —— 都试过，见 .glass-mock/variants.html 的四格对照）。
     这里只留一层**全白的极淡釉雾**给体积感，冷色一律不要。 */
  --dsh-lg-frost-bg:linear-gradient(180deg,rgba(255,255,255,.24),rgba(250,251,253,.18) 60%,rgba(255,255,255,.28) 100%);
  --dsh-lg-inner-shadow:inset 0 1px 0 rgba(255,255,255,1),
                        inset 0 -1px 0 rgba(255,255,255,.55),
                        inset 0 0 26px rgba(255,255,255,.30)}
body[data-ds-dark-theme] .dsh-lg{
  box-shadow:none;
  --dsh-lg-c1:126,178,248;
  --dsh-lg-c2:168,208,252;
  --dsh-lg-spec:rgba(255,255,255,.40);
  --dsh-lg-bloom-a:.5;
  --dsh-lg-bloom:radial-gradient(62% 150% at 50% 0%,rgba(255,255,255,.14),transparent 70%),
                 radial-gradient(70% 170% at 50% 100%,rgba(130,175,235,.14),transparent 72%);
  --dsh-lg-frost-bg:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,0) 72%);
  --dsh-lg-inner-shadow:inset 0 1px 0 rgba(255,255,255,.26)}

/* ============ 1 磨砂层：白雾 + 重度模糊（玻璃的"磨砂感"来自这里） ============ */
.dsh-lg-frost{position:absolute;inset:-2px;border-radius:inherit;overflow:hidden;
  filter:blur(26px) saturate(115%);
  background:var(--dsh-lg-frost-bg)}

/* ============ 2 极淡冷调底：静态，不旋转不漂移 ============ */
.dsh-lg-glow{position:absolute;inset:0;border-radius:inherit;overflow:hidden;opacity:0;
  transition:opacity 1.4s cubic-bezier(.4,0,.2,1)}
.dsh-lg[data-busy="1"] .dsh-lg-glow{opacity:1}
.dsh-lg-wash{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(var(--dsh-lg-c1),.055),transparent 58%),
             linear-gradient(0deg,rgba(var(--dsh-lg-c1),.075),transparent 42%)}

/* ============ 3 镶边 ============
   ⚠ 已删除（用户点名）。原实现是「放大的盒子 + mask 只留边线」：
     .dsh-lg-rim{left:-60%;top:-260%;width:220%;height:620%;rotate 150s}
   盒子是玻璃的 2.2×6.2 倍，mask-composite 一旦不生效（或在不同合成路径下不生效），
   看到的就是一圈**巨大的、会转的矩形框**；深色下再叠 mix-blend-mode:screen，亮得刺眼。
   要做镶边请改成：**盒子就是玻璃本身**，用 conic-gradient 做背景 + mask 挖空内部，
   绝不放大盒子。 */

/* ============ 4 顶部镜面高光 ============ */
.dsh-lg-spec{position:absolute;inset:0;border-radius:inherit;mix-blend-mode:overlay;
  background-image:radial-gradient(circle at 50% -8%,var(--dsh-lg-spec) 0%,transparent 48%)}

/* ============ 5 内缘白线（Apple 玻璃最标志性的一笔） ============ */
.dsh-lg-inner{position:absolute;inset:0;border-radius:inherit;
  box-shadow:var(--dsh-lg-inner-shadow)}

/* ============ 6 外扩散泛光：光从玻璃边缘溢出来 ============ */
.dsh-lg-bloom{position:absolute;inset:-9px;border-radius:calc(var(--dsh-lg-radius,20px) + 8px);
  filter:blur(15px);opacity:var(--dsh-lg-bloom-a,.5);background:var(--dsh-lg-bloom);
  transition:opacity 1.4s cubic-bezier(.4,0,.2,1)}
.dsh-lg[data-busy="1"] .dsh-lg-bloom{opacity:.8}

/* ============ 三点吐泡泡：只在"模型思考中"出现 ============
   策略（用户 2026-10-11 定的）：**同一列、同一个出生点**，靠 1/3 周期错相自然摊开成
   三层——底下那颗刚新生（小、淡，贴在发送箭头上方）→ 中间那颗正在上升 → 顶上那颗
   快要破灭/刚破灭（大、淡）。所以三颗**不能各站一个起点**：起点只有一个，
   纵向距离全部来自 --dsh-lg-bub-rise 的上升位移。
   循环必须在关键帧里自己收束（最后 opacity 归零），别指望 overflow。
   调参只动这三个：--dsh-lg-bub-rise（上升距离）/ --dsh-lg-bub-bottom（出生高度）/
   --dsh-lg-bub-right（离右边多远）；--dsh-lg-bub-dur 是整轮时长。 */
.dsh-lg-bubbles{position:absolute;inset:0;border-radius:inherit;overflow:hidden;
  opacity:0;transition:opacity .5s ease;pointer-events:none;
  --dsh-lg-bub:9px;--dsh-lg-bub-dur:3.6s;--dsh-lg-bub-rise:46px;
  --dsh-lg-bub-right:25px;--dsh-lg-bub-bottom:40px}
.dsh-lg-bubbles[data-on="1"]{opacity:1}
.dsh-lg-bubbles i{position:absolute;display:block;
  right:var(--dsh-lg-bub-right);bottom:var(--dsh-lg-bub-bottom);
  width:var(--dsh-lg-bub);height:var(--dsh-lg-bub);border-radius:50%;
  background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.95),
    rgba(var(--dsh-lg-c2),.9) 46%,rgba(var(--dsh-lg-c1),.8));
  box-shadow:0 0 9px rgba(var(--dsh-lg-c1),.55),inset -1px -1px 2px rgba(255,255,255,.4);
  animation:dsh-lg-bubble var(--dsh-lg-bub-dur) linear infinite}
/* 三颗同一出生点，只有相位不同（1/3、2/3 周期） */
.dsh-lg-bubbles i:nth-child(2){animation-delay:calc(var(--dsh-lg-bub-dur) / -3)}
.dsh-lg-bubbles i:nth-child(3){animation-delay:calc(var(--dsh-lg-bub-dur) / -3 * 2)}
@keyframes dsh-lg-bubble{
  0%{transform:translate(0,calc(var(--dsh-lg-bub-rise) * .04)) scale(.2);opacity:0}
  8%{transform:translate(0,calc(var(--dsh-lg-bub-rise) * -.04)) scale(.72);opacity:1}
  40%{transform:translate(2px,calc(var(--dsh-lg-bub-rise) * -.35)) scale(.98);opacity:1}
  74%{transform:translate(-1px,calc(var(--dsh-lg-bub-rise) * -.65)) scale(1.08);opacity:.95}
  92%{transform:translate(1px,calc(var(--dsh-lg-bub-rise) * -.88)) scale(1.3);opacity:.6}
  100%{transform:translate(1.5px,calc(var(--dsh-lg-bub-rise) * -1)) scale(1.5);opacity:0}}

/* ============ 真·毛玻璃（浅色/深色都做）============
   ⚠ 为什么必须动原生卡片：玻璃层是**盖在卡片内容之上**的 overlay。
     · 对它加白色 → 文字和发送按钮被压淡（.88 时按钮从实心蓝变淡紫）
     · 对它做 backdrop-filter → 把卡片自己的文字一起糊掉
     所以"毛玻璃"只有唯一的物理位置：**卡片自己的背景**。
   ① 卡片底半透明（**冷白而不是纯白**：纯白在白页上只会更白，冷白 + 上浅下深的渐变
      才有"雾蒙蒙"的体积感；用户原话"稍微带点雾蒙蒙的感觉，不要太过于白"）
   ② 卡片自己做 backdrop-filter（内容在它上面，照样锐利）
   ③ 输入框所在"座位"那道「透明→不透明」的渐隐必须让开：否则卡片背后是纯色，
      糊纯色 = 什么都看不见（这是最容易踩的一条：看起来像 blur 没生效）。
   旋钮都在卡片上，随手可调：
     --dsh-lg-glass-tint    底色（**釉色白用中性偏亮的白**，如 #f5f6f8；冷白 #e6ecf7 会变成蓝釉）
     --dsh-lg-glass-top / --dsh-lg-glass-bottom  上/下两端的浓度，差值就是"雾的体积"
     --dsh-lg-glass-blur    越大越糊
   两处覆盖都用 !important 顶住主题切换；不想要毛玻璃，删掉本块即可。 */
[data-composer-card]{
  --dsh-lg-glass-tint:#f5f6f8;   /* 釉色白：中性偏亮的白（**不是**冷白 #e6ecf7，那是蓝釉的来源） */
  --dsh-lg-glass-top:22%;
  --dsh-lg-glass-bottom:32%;
  --dsh-lg-glass-blur:30px;
  background:linear-gradient(180deg,
    color-mix(in srgb, var(--dsh-lg-glass-tint) var(--dsh-lg-glass-top), transparent) 0%,
    color-mix(in srgb, var(--dsh-lg-glass-tint) var(--dsh-lg-glass-bottom), transparent) 100%) !important;
  backdrop-filter:blur(var(--dsh-lg-glass-blur)) saturate(150%);
  -webkit-backdrop-filter:blur(var(--dsh-lg-glass-blur)) saturate(150%)}
body[data-ds-dark-theme] [data-composer-card]{
  --dsh-lg-glass-tint:#3a4050;
  --dsh-lg-glass-top:40%;
  --dsh-lg-glass-bottom:50%;
  --dsh-lg-glass-blur:30px;
  background:linear-gradient(180deg,
    color-mix(in srgb, var(--dsh-lg-glass-tint) var(--dsh-lg-glass-top), transparent) 0%,
    color-mix(in srgb, #272c39 var(--dsh-lg-glass-bottom), transparent) 100%) !important}
[data-composer-seat]{background:none !important}

/* ============ 主题过渡：只在自己的层里补间，且只在窗口期 ============ */
html.dsh-lg-theming .dsh-lg,
html.dsh-lg-theming .dsh-lg *,
html.dsh-lg-theming .dsh-lg-bubbles i{
  transition:background-color 1.7s cubic-bezier(.4,0,.2,1),
             border-color 1.7s cubic-bezier(.4,0,.2,1),
             color 1.7s cubic-bezier(.4,0,.2,1),
             box-shadow 1.7s cubic-bezier(.4,0,.2,1),
             opacity 1.7s cubic-bezier(.4,0,.2,1)}

/* ============ 无障碍 ============ */
@media (prefers-reduced-motion: reduce){
  .dsh-lg-bubbles i{animation:none!important}
  .dsh-lg-bubbles i{opacity:.85}
  .dsh-lg-bubbles i{transform:none}
  html.dsh-lg-theming .dsh-lg,html.dsh-lg-theming .dsh-lg *{transition:none!important}
}

/* ============ 顺手修 DSH 自己的 / 菜单"看着没底板" ============
   DSH 把菜单底色画在 MenuSurface 的 .material 上：
     background: var(--dsw-menu-surface-fill);  backdrop-filter: blur(40px) saturate(150%)
   Windows 上这两个值是 浅色 #f8f9fa94（≈58% 不透明）/ 深色 #43454a73（≈45% 不透明），
   也就是"半透明底 + 糊背景" —— 背后要是纯色（浅色主题的白底），就没东西可糊，
   面板边界直接消失，看着就是"透明"。
   这里换成 DSH 自己在 macOS 分支用的那组 94% 不透明值，且只作用于 / 唤起的那张菜单。
   不想要这段，删掉本块即可（不影响玻璃本身）。 */
[data-trigger-menu]{--dsw-menu-surface-fill:#f8f9faf0}
body[data-ds-dark-theme] [data-trigger-menu]{--dsw-menu-surface-fill:#303136f0}
`

    /** 挂全局样式；重复挂载时只保留一份。 */
    function ensureStyle() {
      if (document.getElementById(STYLE_ID) !== null) return () => {}
      const tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.parentNode?.removeChild(tag)
      }
    }

    /**
     * 兜底探测：模型是否在跑。
     *
     * 主来源是标准 props 的 `useSession((s) => s.running)`；但万一这个属性在某些装配下
     * 不存在（后果很隐蔽：气泡永远不出现、看不到报错），就退化为观察原生发送按钮 ——
     * 运行中它会从「发送」变成「停止」，这是个可靠的 DOM 信号，也是零配置的。
     *
     * @param enabled 是否启用（只有拿不到 useSession 时才需要）
     * @returns 是否处于运行中
     */
    function useRunningFallback(enabled) {
      const [busy, setBusy] = React.useState(false)
      React.useEffect(() => {
        if (!enabled) return undefined
        const STOP = /stop|停止|中止|终止|cancel|取消/i
        const read = () => {
          const btn = document.querySelector('[data-composer-card] button[aria-label], [data-composer-card] button[title]')
          const text = `${btn?.getAttribute('aria-label') ?? ''} ${btn?.getAttribute('title') ?? ''}`
          return STOP.test(text)
        }
        setBusy(read())
        if (typeof MutationObserver !== 'function') return undefined
        const observer = new MutationObserver(() => setBusy(read()))
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label', 'title'] })
        return () => observer.disconnect()
      }, [enabled])
      return busy
    }

    /**
     * 玻璃层组件。
     *
     * @param props.input 标准输入 props（占位，用于拿到 session 上下文）。
     * @param props.useSession 会话快照选择器钩子：`s.running` 就是"模型正在思考"。
     */
    function GlassLayer(props) {
      const hostRef = React.useRef(null)
      // 直接持有 DOM 引用，避免每次状态变化都去查询；也让"忙碌状态"不会因查询落空而静默失效
      const layerRef = React.useRef(null)
      const bubblesRef = React.useRef(null)

      // ⚠ 三条 hook 必须**无条件、定序**调用：写成 `cond ? useX() : y` 会违反 hooks 规则，
      //   而这个属性是否存在的判断本身不该影响 hook 调用顺序。
      const useSession = typeof props.useSession === 'function' ? props.useSession : undefined
      const runningBySession = useSession === undefined
        ? false
        : useSession((s) => s.running === true)
      const runningByDom = useRunningFallback(useSession === undefined)
      const running = useSession === undefined ? runningByDom : runningBySession

      // 建一次 DOM（这一层不参与 React 重渲染）
      React.useEffect(() => {
        const host = hostRef.current
        if (host === null || host === undefined) return undefined
        const node = document.createElement('div')
        node.className = 'dsh-lg'
        node.setAttribute('aria-hidden', 'true')
        node.innerHTML = [
          '<div class="dsh-lg-bloom"></div>',
          '<div class="dsh-lg-frost"></div>',
          '<div class="dsh-lg-glow"><div class="dsh-lg-wash"></div></div>',
          '<div class="dsh-lg-spec"></div>',
          '<div class="dsh-lg-inner"></div>',
          '<div class="dsh-lg-bubbles"><i></i><i></i><i></i></div>',
        ].join('')
        host.appendChild(node)
        layerRef.current = node
        bubblesRef.current = node.querySelector('.dsh-lg-bubbles')
        return () => {
          layerRef.current = null
          bubblesRef.current = null
          node.parentNode?.removeChild(node)
        }
      }, [])

      // 几何锚定：把玻璃贴合到原生输入框卡片上。
      // ⚠ 不能直接写卡片的视口坐标（getBoundingClientRect().left/top）：
      //   宿主 `.dsh-lg-root` 是 position:fixed，它的**包含块**不一定还是视口 ——
      //   只要祖先里出现 filter / backdrop-filter / transform / will-change，
      //   包含块就变成那个祖先（我们给 [data-composer-card] 加 backdrop-filter 做毛玻璃，
      //   于是包含块从视口变成了卡片本身，偏移被叠加两次，整层跑到右下角）。
      //   所以取「卡片矩形 − 自己宿主的矩形」这个**差值**，与包含块是谁无关。
      // 只读原生布局，不写它的样式；找不到卡片就整体隐藏（宁可不显示，也不要铺满屏）。
      React.useEffect(() => {
        const host = hostRef.current
        if (host === null || host === undefined) return undefined
        let card
        let observer
        const sync = () => {
          try {
            if (card === undefined || card === null || !card.isConnected) {
              card = document.querySelector('[data-composer-card]')
            }
            if (card === null || card === undefined) {
              host.dataset.anchored = '0'
              return
            }
            const r = card.getBoundingClientRect()
            if (r.width < 20 || r.height < 8) {
              host.dataset.anchored = '0'
              return
            }
            const origin = host.getBoundingClientRect()
            host.style.setProperty('--dsh-lg-x', `${(r.left - origin.left).toFixed(1)}px`)
            host.style.setProperty('--dsh-lg-y', `${(r.top - origin.top).toFixed(1)}px`)
            host.style.setProperty('--dsh-lg-w', `${r.width.toFixed(1)}px`)
            host.style.setProperty('--dsh-lg-h', `${r.height.toFixed(1)}px`)
            if (typeof getComputedStyle === 'function') {
              const radius = getComputedStyle(card).borderTopLeftRadius
              if (typeof radius === 'string' && radius !== '' && radius !== '0px') {
                host.style.setProperty('--dsh-lg-radius', radius)
              }
            }
            host.dataset.anchored = '1'
          } catch (err) {
            console.debug('[liquid-glass] 锚定失败，暂时隐藏：', err)
            host.dataset.anchored = '0'
          }
        }
        sync()
        const target = host.parentElement
        if (typeof ResizeObserver === 'function' && target !== null && target !== undefined) {
          try {
            observer = new ResizeObserver(sync)
            observer.observe(target)
          } catch { /* 观察不了就算了，还有下面的事件 */ }
        }
        window.addEventListener('resize', sync)
        window.addEventListener('scroll', sync, true)
        // 首帧后可能才有布局，再对齐一次
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(sync) : 0
        return () => {
          if (observer !== undefined) observer.disconnect()
          window.removeEventListener('resize', sync)
          window.removeEventListener('scroll', sync, true)
          if (raf !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
        }
      }, [])

      // 忙碌状态：只改两个属性，不触发整层重渲染
      React.useEffect(() => {
        const node = layerRef.current
        if (node === null || node === undefined) return
        node.dataset.busy = running ? '1' : '0'
        const bubbles = bubblesRef.current
        if (bubbles !== null && bubbles !== undefined) bubbles.dataset.on = running ? '1' : '0'
      }, [running])

      return React.createElement('div', {
        ref: hostRef,
        'aria-hidden': 'true',
        'data-anchored': '0',
        className: 'dsh-lg-root',
      })
    }

    exports.name = 'liquid-glass-composer'
    exports.inject = ['slots', 'theme']
    exports.GlassLayer = GlassLayer

    exports.apply = function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      ctx.effect(ensureStyle, 'liquid-glass: stylesheet')

      slots.inject('conversation.input.overlay', () => slots.register(
        { name: 'conversation.input.overlay', id: 'liquid-glass', order: 20, label: '液态玻璃' },
        (props) => React.createElement(GlassLayer, props),
      ))

      // 主题过渡窗口：借 DSH 自己的 theme/change 事件，只在窗口期给玻璃加补间
      if (typeof ctx.on === 'function') {
        ctx.effect(() => {
          let timer = 0
          const off = ctx.on('theme/change', () => {
            document.documentElement.classList.add('dsh-lg-theming')
            clearTimeout(timer)
            timer = setTimeout(() => {
              document.documentElement.classList.remove('dsh-lg-theming')
            }, THEME_WINDOW_MS)
          })
          return () => {
            clearTimeout(timer)
            document.documentElement.classList.remove('dsh-lg-theming')
            if (typeof off === 'function') off()
          }
        }, 'liquid-glass: theme transition window')
      }
    }

    return module.exports
  },
})
