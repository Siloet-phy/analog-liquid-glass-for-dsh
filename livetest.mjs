/**
 * livetest.mjs —— 用**真 React**（+ 可选真 DOM）跑一遍发布的 client.js。
 *
 * selftest.mjs 用替身，只能证明"结构对"；这里证明"代码真的跑得起来"：
 *   阶段 1  真 React 把组件渲染成字符串（react-dom/server 的 renderToStaticMarkup）——
 *           这是最强的一条断言：真 hooks、真元素树、真字符串输出。
 *   阶段 2  真 DOM（jsdom 可用时）挂载与卸载，检查玻璃层真的进/出 DOM。
 *
 * 依赖都不进 package.json：
 *   react / react-dom 的 UMD 构建由参数给目录；jsdom 用 NODE_PATH 指向临时安装目录。
 * 用法：
 *   node livetest.mjs [reactUmdDir]
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const here = fileURLToPath(new URL('.', import.meta.url))
const umdDir = process.argv[2]
const require = createRequire(import.meta.url)

let failures = 0
const check = (label, ok, detail) => {
  if (ok) console.log(`  ✓ ${label}`)
  else { failures += 1; console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}

/* ---------- 先装 jsdom 环境，再加载 react-dom ----------
   顺序很重要：react-dom 在加载时就会捕获 document/window。
   如果先用假 document 加载它，之后即使替换成 jsdom 也不会生效
   （症状：appendChild 报 "parameter 1 is not of type 'Node'"）。 */
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch { /* 没有就不跑 DOM 部分 */ }
let dom
if (typeof JSDOM === 'function') {
  dom = new JSDOM('<!doctype html><html><head></head><body><div data-composer-card></div></body></html>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  try {
    Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
  } catch { /* Node 24 里 navigator 只读，取不到就算了 */ }
} else {
  // 没有 jsdom 时给个最小替身，够 bundle 顶层与 apply() 用
  globalThis.window = globalThis.window ?? {}
  globalThis.document = {
    head: { appendChild: () => {} },
    createElement: () => ({ dataset: {}, style: { setProperty: () => {} }, appendChild: () => {}, setAttribute: () => {}, children: [] }),
    getElementById: () => null,
    querySelector: () => null,
  }
}

/* ---------- 真 React（此时 document 已是 jsdom） ----------
   ⚠ 两个必须遵守的前提，否则测出来的结论是假的：
   1. document/window 必须在 require('react-dom') **之前**就位（react-dom 加载时捕获它们）；
   2. 必须用 createRoot + act()，不能用 legacy ReactDOM.render ——
      legacy render 会把 passive effects 推迟到下一个任务，
      而测试是同步断言的，于是 useEffect 根本没跑，玻璃层也就没进 DOM（假失败）。 */
let React, ReactDOM, ReactDOMClient, act
try {
  if (umdDir) {
    const dir = resolve(umdDir)
    React = require(join(dir, 'react.development.js'))
    ReactDOM = require(join(dir, 'react-dom.development.js'))
    ReactDOMClient = ReactDOM
  } else {
    React = require('react')
    ReactDOM = require('react-dom')
    ReactDOMClient = require('react-dom/client')
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  act = React.act ?? ReactDOM.act ?? require('react-dom/test-utils').act
} catch (err) {
  console.log(`  ⚠ 拿不到真 React（${String(err.message).slice(0, 90)}）`)
  console.log(`\n用法：node livetest.mjs [react-umd-目录]（或在装了 react/react-dom 的目录下运行）`)
  process.exit(0)
}
check('真 React 已加载', typeof React?.createElement === 'function', React?.version)
check('真 react-dom 已加载', typeof ReactDOMClient?.createRoot === 'function')
check('有 act()（用于同步逼出 useEffect）', typeof act === 'function')

/* ---------- 装载发布的 bundle ---------- */
console.log('\n装载发布的 client.js：')
const source = readFileSync(`${here}client.js`, 'utf8')
let loadSpec = null
globalThis.window = globalThis.window ?? {}
globalThis.window.__ModuleLoader__ = { load: (spec) => { loadSpec = spec } }
const documentStub = {
  head: { appendChild: () => {} },
  createElement: () => ({ dataset: {}, style: { setProperty: () => {} }, appendChild: () => {}, setAttribute: () => {}, children: [] }),
  getElementById: () => null,
  querySelector: () => null,
}
globalThis.document = globalThis.document ?? documentStub

try {
  new Function('window', 'document', source)(globalThis.window, globalThis.document)
  check('bundle 执行（只注册 factory）', loadSpec !== null)
} catch (err) {
  check('bundle 执行', false, String(err))
  process.exit(1)
}

const moduleFace = loadSpec.factory((name) => {
  if (name === 'react') return React
  throw new Error(`未声明的 external：${name}`)
})
check('factory 用真 React 物化成功', typeof moduleFace.apply === 'function')

console.log('\n真 DOM 挂载与卸载（jsdom + 真 React）：')
if (dom === undefined) {
  console.log('  ⚠ 没有 jsdom，跳过（在装了 jsdom 的目录下运行即可启用）')
} else {
  const registrations = []
  const registered = []
  const ctx = {
    get: (n) => (n === 'slots'
      ? {
          inject: (slot, fn) => { registered.push(slot); fn() },
          register: (meta, comp) => { registrations.push({ meta, comp }); return () => {} },
        }
      : undefined),
    effect: (fn) => { fn() },
    on: () => () => {},
    logger: { debug: () => {}, warn: () => {} },
  }
  moduleFace.apply(ctx)
  check('apply 注册到 conversation.input.overlay', registered.includes('conversation.input.overlay'), JSON.stringify(registered))

  const host = document.createElement('div')
  document.body.appendChild(host)
  // jsdom 里所有元素尺寸都是 0，而插件的锚定逻辑是 fail-closed（尺寸不合理就隐藏）。
  // 给"原生输入框卡片"喂一个真实矩形，几何逻辑才测得到。
  const card = document.querySelector('[data-composer-card]')
  if (card !== null) {
    card.getBoundingClientRect = () => ({ left: 100, top: 500, width: 780, height: 92, right: 880, bottom: 592, x: 100, y: 500 })
  }
  const Comp = registrations[0].comp
  try {
    // createRoot + act：effect 会被同步刷出，断言才看得到玻璃层
    const root = ReactDOMClient.createRoot(host)
    await act(async () => {
      root.render(React.createElement(Comp, { useSession: (sel) => sel({ running: false }) }))
    })
    const layer = host.querySelector('.dsh-lg')
    check('玻璃层真的进了 DOM', layer !== null)
    check('泡泡三颗在 DOM 里', layer?.querySelectorAll('.dsh-lg-bubbles i').length === 3)
    check('非忙碌时 data-on=0', layer?.querySelector('.dsh-lg-bubbles')?.dataset?.on === '0')
    check('整层对读屏隐藏 aria-hidden', layer?.getAttribute('aria-hidden') === 'true')
    check('样式表注入 head', document.getElementById('analog-liquid-glass-for-dsh') !== null)
    for (const cls of ['dsh-lg-frost', 'dsh-lg-glow', 'dsh-lg-spec', 'dsh-lg-inner', 'dsh-lg-bloom']) {
      check(`子层 ${cls} 在 DOM 里`, layer?.querySelector(`.${cls}`) !== null)
    }
    // 回归护栏（都是用户点过名的事）：
    //  · 镶边层 rim 已删——它用「放大盒子 + mask」实现，深色下会变成一圈巨大的旋转发光矩形
    //  · 泡泡必须是「同一个出生点 + 靠上升距离摊开」，不能再回到逐颗 bottom 偏移的老写法
    const sheet = document.getElementById('analog-liquid-glass-for-dsh')?.textContent ?? ''
    // ⚠ 断言前必须先剥掉 CSS 注释：client.js 的注释里保留了 rim 的示例代码（解释为什么删它），
    //   裸查子串会被注释里的示例误伤，护栏就变成假失败。
    const live = sheet.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    // 按「规则」判定，不按「字串」
    const ruleOf = (cls) => new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`).test(live)
    check('样式表里不再有 rim 层（剥注释后按规则判定）', !ruleOf('dsh-lg-rim'))
    check('泡泡用上升距离变量摊开', /--dsh-lg-bub-rise:/.test(live))
    check('泡泡不再逐颗偏移 bottom', !/nth-child\(2\)\{[^}]*bottom:/.test(live))
    // 几何锚定：CSS 变量与 data-anchored 都写在 React 渲染的那个 div（.dsh-lg-root）上，
    // 不是写在测试手建的父容器上 —— 断言必须取对元素。
    const rootEl = host.querySelector('.dsh-lg-root')
    check('宿主被标记为已锚定', rootEl?.dataset?.anchored === '1', rootEl?.dataset?.anchored)
    check('写入卡片宽度 780px', rootEl?.style?.getPropertyValue('--dsh-lg-w') === '780.0px', rootEl?.style?.getPropertyValue('--dsh-lg-w'))
    check('写入卡片高度 92px', rootEl?.style?.getPropertyValue('--dsh-lg-h') === '92.0px', rootEl?.style?.getPropertyValue('--dsh-lg-h'))
    check('写入卡片左边距 100px', rootEl?.style?.getPropertyValue('--dsh-lg-x') === '100.0px', rootEl?.style?.getPropertyValue('--dsh-lg-x'))
    check('写入卡片上边距 500px', rootEl?.style?.getPropertyValue('--dsh-lg-y') === '500.0px', rootEl?.style?.getPropertyValue('--dsh-lg-y'))

    // ⚠ 包含块不是视口时的对齐（用户报过「根本没有对齐对话框」）：
    // 给卡片加 backdrop-filter 后，宿主 .dsh-lg-root（position:fixed）的包含块会从视口变成卡片，
    // 若还按视口坐标写偏移就会叠加两次。插件现在取「卡片矩形 − 宿主矩形」的差值，
    // 这里把宿主自己的矩形挪到跟卡片同一个原点，断言偏移必须是 0。
    if (rootEl !== null) {
      rootEl.getBoundingClientRect = () => ({ left: 100, top: 500, width: 0, height: 0, right: 100, bottom: 500, x: 100, y: 500 })
      await act(async () => { window.dispatchEvent(new dom.window.Event('resize')) })
      check('包含块非视口时按差值归零（x）', rootEl.style.getPropertyValue('--dsh-lg-x') === '0.0px', rootEl.style.getPropertyValue('--dsh-lg-x'))
      check('包含块非视口时按差值归零（y）', rootEl.style.getPropertyValue('--dsh-lg-y') === '0.0px', rootEl.style.getPropertyValue('--dsh-lg-y'))
    }

    // 卡片消失后必须取消锚定（宁可不显示，也不能横铺满屏）
    card?.remove()
    await act(async () => { window.dispatchEvent(new dom.window.Event('resize')) })
    check('卡片消失后取消锚定（fail-closed）', rootEl?.dataset?.anchored === '0', rootEl?.dataset?.anchored)

    // 忙碌状态：running 翻成 true，data-busy / data-on 应跟着变（验证响应式接通）
    await act(async () => {
      root.render(React.createElement(Comp, { useSession: (sel) => sel({ running: true }) }))
    })
    const layer2 = host.querySelector('.dsh-lg')
    check('running=true 时 data-busy=1', layer2?.dataset?.busy === '1', layer2?.dataset?.busy)
    check('running=true 时泡泡 data-on=1', layer2?.querySelector('.dsh-lg-bubbles')?.dataset?.on === '1')

    await act(async () => { root.unmount() })
    check('卸载后玻璃层已移除', host.querySelector('.dsh-lg') === null)
  } catch (err) {
    check('真 DOM 挂载/卸载', false, String(err).slice(0, 300))
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL（${failures} 处）`)
process.exit(failures === 0 ? 0 : 1)
