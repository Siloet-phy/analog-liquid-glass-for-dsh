/**
 * dsh-liquid-glass-composer —— 给 DSH Web 输入框铺一层"液态玻璃"
 *
 * 形状：输入框是玻璃；模型思考时，玻璃里往上冒泡。
 *
 * 设计边界（改动前先读这三条）：
 *  1. 只往 slot 里**加层**，绝不改 DSH 原生输入框的样式或结构。
 *     玻璃层是自己独立的一层，靠 CSS 变量取尺寸，原生主题切换不会打架。
 *  2. 玻璃里**不放彩色**。Apple 的液态玻璃本身近乎无色，颜色只允许出现在
 *     边缘的镶边、顶部镜面、以及外扩散泛光上。
 *  3. 主题过渡：DSH 自己切主题时监听 `theme/change`，只在过渡窗口期给玻璃加
 *     1.7s 的补间（比整页慢）；窗口期外不加 transition，平时交互不受影响。
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
/* ============ 挂载层：不吃鼠标事件，纯视觉 ============ */
.dsh-lg{position:absolute;inset:0;pointer-events:none;
  border-radius:var(--dsh-lg-radius,20px);
  /* 深/浅两套色值，跟随 DSH 的 body[data-ds-dark-theme] */
  --dsh-lg-c1:112,176,244;
  --dsh-lg-c2:150,205,250;
  --dsh-lg-wash:rgba(255,255,255,.72);
  --dsh-lg-spec:rgba(255,255,255,.95);
  --dsh-lg-inner-line:rgba(255,255,255,.95);
  --dsh-lg-bloom:radial-gradient(62% 150% at 50% 0%,rgba(255,255,255,.75),transparent 72%),
                 radial-gradient(70% 170% at 50% 100%,rgba(110,160,230,.20),transparent 72%)}
body[data-ds-dark-theme] .dsh-lg{
  --dsh-lg-c1:126,178,248;
  --dsh-lg-c2:168,208,252;
  --dsh-lg-wash:rgba(255,255,255,.05);
  --dsh-lg-spec:rgba(255,255,255,.40);
  --dsh-lg-inner-line:rgba(255,255,255,.26);
  --dsh-lg-bloom:radial-gradient(62% 150% at 50% 0%,rgba(255,255,255,.14),transparent 70%),
                 radial-gradient(70% 170% at 50% 100%,rgba(130,175,235,.14),transparent 72%)}

/* ============ 1 磨砂层：白雾 + 重度模糊（玻璃的"磨砂感"来自这里） ============ */
.dsh-lg-frost{position:absolute;inset:-2px;border-radius:inherit;overflow:hidden;
  filter:blur(26px) saturate(115%);
  background:linear-gradient(180deg,var(--dsh-lg-wash),transparent 72%)}

/* ============ 2 极淡冷调底：静态，不旋转不漂移 ============ */
.dsh-lg-glow{position:absolute;inset:0;border-radius:inherit;overflow:hidden;opacity:0;
  transition:opacity 1.4s cubic-bezier(.4,0,.2,1)}
.dsh-lg[data-busy="1"] .dsh-lg-glow{opacity:1}
.dsh-lg-wash{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(var(--dsh-lg-c1),.055),transparent 58%),
             linear-gradient(0deg,rgba(var(--dsh-lg-c1),.075),transparent 42%)}

/* ============ 3 镶边：1.5px 缓慢绕行 ============
   ⚠ mask-composite 必须 webkit 前缀 + 标准属性双写，否则整块糊成实心。 */
.dsh-lg-rim{position:absolute;left:-60%;top:-260%;width:220%;height:620%;padding:1.5px;
  border-radius:var(--dsh-lg-radius,20px);mix-blend-mode:screen;opacity:.42;will-change:transform;
  animation:dsh-lg-rim-spin 150s linear infinite;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  mask-composite:exclude;
  background:conic-gradient(from -18deg,
    rgba(255,255,255,0) 0%, rgba(255,255,255,.30) 12%, rgba(255,255,255,.92) 20%,
    rgba(255,255,255,.34) 28%, rgba(255,255,255,0) 42%, rgba(220,236,255,.22) 62%,
    rgba(255,255,255,.62) 70%, rgba(255,255,255,0) 84%)}
@keyframes dsh-lg-rim-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

/* ============ 4 顶部镜面高光 ============ */
.dsh-lg-spec{position:absolute;inset:0;border-radius:inherit;mix-blend-mode:overlay;
  background-image:radial-gradient(circle at 50% -8%,var(--dsh-lg-spec) 0%,transparent 48%)}

/* ============ 5 内缘白线（Apple 玻璃最标志性的一笔） ============ */
.dsh-lg-inner{position:absolute;inset:0;border-radius:inherit;
  box-shadow:inset 0 1px 0 var(--dsh-lg-inner-line)}

/* ============ 6 外扩散泛光：光从玻璃边缘溢出来 ============ */
.dsh-lg-bloom{position:absolute;inset:-9px;border-radius:calc(var(--dsh-lg-radius,20px) + 8px);
  filter:blur(15px);opacity:.5;background:var(--dsh-lg-bloom);
  transition:opacity 1.4s cubic-bezier(.4,0,.2,1)}
.dsh-lg[data-busy="1"] .dsh-lg-bloom{opacity:.8}

/* ============ 三点吐泡泡：只在"模型思考中"出现 ============
   一个破灭、一个新生（三颗错开 1/3 周期）。循环必须在关键帧里自己收束，
   别指望 overflow —— 上一版做成无限上浮就看不出"破灭"，还会飘出容器。 */
.dsh-lg-bubbles{position:absolute;inset:0;border-radius:inherit;overflow:hidden;
  opacity:0;transition:opacity .5s ease;pointer-events:none;
  --dsh-lg-bub:8px;--dsh-lg-bub-dur:3.6s}
.dsh-lg-bubbles[data-on="1"]{opacity:1}
.dsh-lg-bubbles i{position:absolute;left:16px;bottom:8px;display:block;
  width:var(--dsh-lg-bub);height:var(--dsh-lg-bub);border-radius:50%;
  background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.95),
    rgba(var(--dsh-lg-c2),.9) 46%,rgba(var(--dsh-lg-c1),.8));
  box-shadow:0 0 9px rgba(var(--dsh-lg-c1),.55),inset -1px -1px 2px rgba(255,255,255,.4);
  animation:dsh-lg-bubble var(--dsh-lg-bub-dur) linear infinite}
.dsh-lg-bubbles i:nth-child(2){left:calc(var(--dsh-lg-bub) + 28px);
  animation-delay:calc(var(--dsh-lg-bub-dur) / -3)}
.dsh-lg-bubbles i:nth-child(3){left:calc(var(--dsh-lg-bub) * 2 + 40px);
  animation-delay:calc(var(--dsh-lg-bub-dur) / -3 * 2)}
@keyframes dsh-lg-bubble{
  0%{transform:translate(0,1px) scale(.2);opacity:0}
  8%{transform:translate(0,-1px) scale(.72);opacity:1}
  40%{transform:translate(2px,-9px) scale(.98);opacity:1}
  74%{transform:translate(-1px,-17px) scale(1.08);opacity:.95}
  92%{transform:translate(1px,-23px) scale(1.3);opacity:.6}
  100%{transform:translate(1.5px,-26px) scale(1.5);opacity:0}}

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
  .dsh-lg-rim,.dsh-lg-bubbles i{animation:none!important}
  .dsh-lg-rim{opacity:.28}
  .dsh-lg-bubbles i{opacity:.85}
  .dsh-lg-bubbles i{transform:none}
  html.dsh-lg-theming .dsh-lg,html.dsh-lg-theming .dsh-lg *{transition:none!important}
}
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

      // 响应式来源：模型是否在跑（Host 的会话运行状态投影）
      const running = typeof props.useSession === 'function'
        ? props.useSession((s) => s.running === true)
        : false

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
          '<div class="dsh-lg-rim"></div>',
          '<div class="dsh-lg-spec"></div>',
          '<div class="dsh-lg-inner"></div>',
          '<div class="dsh-lg-bubbles"><i></i><i></i><i></i></div>',
        ].join('')
        host.appendChild(node)
        layerRef.current = node
        bubblesRef.current = node.querySelector('.dsh-lg-bubbles')

        // 取原生卡片的圆角，让玻璃严格贴合（只读，不写原生样式）。
        // 全程防御式：getComputedStyle 在非浏览器环境可能不存在；拿不到就用自己的默认圆角。
        const card = document.querySelector('[data-composer-card]')
        const sync = () => {
          if (card === null || card === undefined) return
          try {
            if (typeof getComputedStyle !== 'function') return
            const radius = getComputedStyle(card).borderTopLeftRadius
            if (typeof radius === 'string' && radius !== '' && radius !== '0px') {
              node.style.setProperty('--dsh-lg-radius', radius)
            }
          } catch (err) {
            console.debug('[liquid-glass] 读原生圆角失败，使用默认值：', err)
          }
        }
        sync()

        return () => {
          layerRef.current = null
          bubblesRef.current = null
          node.parentNode?.removeChild(node)
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
        style: { position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' },
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
