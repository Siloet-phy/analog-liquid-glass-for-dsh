/**
 * selftest.mjs —— 用替身把 client.js 当"客户端 bundle"跑一遍。
 *
 * 为什么需要它：客户端 bundle 一旦在最顶层抛错，会影响到 Web 端的模块系统；
 * 而它在浏览器里加载、没有现成的测试路径。这里用替身把
 * `window.__ModuleLoader__.load({ id, factory })` 的模式复现出来，
 * 并用假的 ctx / slots / React 把 apply() 走通，确认：
 *   ① 文件可被 eval（语法与顶层副作用没问题）
 *   ② factory(require) 返回的模块面有 name / inject / apply
 *   ③ apply(ctx) 在"有 slots / 有 theme"和"没有服务"两种情况下都不抛错
 *   ④ 注册的 slot 名、组件工厂、样式表挂载行为都对
 *
 * 用法：node selftest.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const source = readFileSync(`${here}client.js`, 'utf8')

let failures = 0
const check = (label, ok, detail) => {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    failures += 1
    console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

/* ---------------- 浏览器替身 ---------------- */
const head = []
const styleNodes = []
const document = {
  head: { appendChild: (n) => { check('样式表追加到 head', n.tagName === 'STYLE'); head.push(n) } },
  createElement: (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      dataset: {},
      style: { setProperty: () => {} },
      setAttribute: () => {},
      innerHTML: '',
      appendChild(c) { this.children.push(c); return c },
      querySelector: () => null,
      querySelectorAll: () => [],
      get parentNode() { return this._parent ?? null },
    }
    if (el.tagName === 'STYLE') styleNodes.push(el)
    return el
  },
  getElementById: (id) => styleNodes.find((n) => n.id === id) ?? null,
  querySelector: () => null,
  documentElement: { classList: { add: () => {}, remove: () => {} } },
}

let loaded = null
globalThis.window = {
  __ModuleLoader__: {
    load: (spec) => { loaded = spec },
  },
}
globalThis.document = document

/* ---------------- React 替身 ---------------- */
const created = []
const reactStub = {
  createElement: (type, props, ...kids) => {
    created.push({ type, props })
    return { type, props, kids }
  },
  useRef: () => ({ current: null }),
  useEffect: () => {},
}

/* ---------------- 跑 client.js ---------------- */
console.log('liquid-glass-composer · client bundle 自检\n')
try {
  new Function('window', 'document', source)(globalThis.window, document)
  check('client.js 可执行（顶层无异常）', true)
} catch (err) {
  check('client.js 可执行（顶层无异常）', false, String(err))
  process.exit(1)
}

check('调用了 __ModuleLoader__.load', loaded !== null)
check('bundle id 正确（与包名一致）', loaded?.id === 'analog-liquid-glass-for-dsh', loaded?.id)
check('factory 是函数', typeof loaded?.factory === 'function')

const moduleFace = loaded.factory((name) => {
  if (name === 'react') return reactStub
  throw new Error(`unexpected require(${name})`)
})

check('导出 name', moduleFace.name === 'analog-liquid-glass-for-dsh', moduleFace.name)
check('导出 inject', Array.isArray(moduleFace.inject) && moduleFace.inject.includes('slots'), JSON.stringify(moduleFace.inject))
check('导出 apply', typeof moduleFace.apply === 'function')
check('导出 GlassLayer 组件', typeof moduleFace.GlassLayer === 'function')

/* ---------------- apply() 的三种情况 ---------------- */
console.log('\napply() 行为：')

// ① 没有 slots 服务：必须静默返回，不能抛
try {
  moduleFace.apply({ get: () => undefined })
  check('无 slots 服务时静默返回', true)
} catch (err) {
  check('无 slots 服务时静默返回', false, String(err))
}

// ② 有 slots + theme：应注册到正确的 slot，并挂样式 + 订阅 theme/change
const registrations = []
const injected = []
const effects = []
const themeListeners = []
const ctx = {
  get: (name) => {
    if (name === 'slots') return { inject: (slot, fn) => { injected.push(slot); fn() }, register: (meta, comp) => { registrations.push({ meta, comp }); return () => {} } }
    if (name === 'theme') return { getTheme: () => ({ theme: { id: 'light', colorScheme: 'light' } }) }
    return undefined
  },
  effect: (fn) => { effects.push(fn); const cleanup = fn(); if (typeof cleanup === 'function') effects.push(cleanup) },
  on: (event, fn) => { themeListeners.push({ event, fn }); return () => {} },
  logger: { debug: () => {}, warn: () => {} },
}

try {
  moduleFace.apply(ctx)
  check('apply 在完整上下文里不抛错', true)
} catch (err) {
  check('apply 在完整上下文里不抛错', false, String(err))
}

check('注入到 conversation.input.overlay', injected.includes('conversation.input.overlay'), JSON.stringify(injected))
const reg = registrations[0]
check('注册 id 为 liquid-glass', reg?.meta?.id === 'analog-liquid-glass', reg?.meta?.id)
check('注册到正确的 slot 名', reg?.meta?.name === 'conversation.input.overlay', reg?.meta?.name)
check('组件是函数（slot 条目）', typeof reg?.comp === 'function')
check('挂过样式表', effects.length > 0)
check('订阅了 theme/change', themeListeners.some((l) => l.event === 'theme/change'))

// ③ 组件能渲染（返回一个 React 元素）
try {
  const el = reg.comp({ useSession: undefined })
  check('组件可渲染（无 useSession 也不炸）', el !== null && el !== undefined)
  const el2 = reg.comp({ useSession: (sel) => sel({ running: true }) })
  check('组件可渲染（useSession 报 running）', el2 !== null && el2 !== undefined)
} catch (err) {
  check('组件可渲染', false, String(err))
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL（${failures} 处）`)
process.exit(failures === 0 ? 0 : 1)
