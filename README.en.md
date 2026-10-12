# Analog Liquid Glass for DeepSeek Harness

> **Turn the DeepSeek Harness composer into a sheet of analog-feeling liquid glass.**

Specular top highlight, an inner white line, a soft bloom spilling past the edge.
Bubbles rise inside the glass while the model thinks. Light/dark switching eases over 1.7s.

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/Siloet-phy/analog-liquid-glass-for-dsh)

![light](docs/light.png)
![dark](docs/dark.png)

## Install

From GitHub (**recommended** — this package is not published to npm yet):

```bash
dsh plugin --profile <your-profile> add github:Siloet-phy/analog-liquid-glass-for-dsh
```

> The desktop build requires DSH to be **fully closed** while its package manager runs;
> restart after installing. The profile is usually `desktop` (desktop app) or `web` (`dsh web`).

If you only want the short form (requires a same-named package on npm):

```bash
dsh plugin --profile <your-profile> add analog-liquid-glass-for-dsh
```

## What it does

| Element | Detail |
|---|---|
| **Frosted glass** | White haze plus heavy blur — this is where the glass feel comes from, not a flat translucent fill |
| **Specular top highlight** | The soft light that makes glass readable as glass |
| **Inner white line** | A hairline along the top edge |
| **Outer bloom** | Light spilling just past the edge of the glass |
| **Bubbles** | **Only while the model is thinking**: three bubbles a third of a cycle apart, from the same spawn point — one bursts, one is born |
| **Theme transition** | On light ↔ dark switch the glass interpolates **slower** than the page (1.7s vs 0.9s) |
| **Real frosting** | To get a genuine frosted look it overrides the native card's background and `backdrop-filter` (see decision 2) |

## Two deliberate decisions

1. **No colour inside the glass.**
   Liquid glass is nearly colourless: clear white glass, a whitened haze, and highlights
   along the edges. Colour belongs only on the edges. Anything that puts a coloured blob
   *inside* the glass reads as coloured plastic.
2. **The glass layer only *adds* a layer** through a slot, matching the native card's rect,
   without changing its DOM structure. The single exception is "real frosting": to get a
   frosted look it overrides `[data-composer-card]`'s background and `backdrop-filter`
   (the only physically sound place for frosting — adding haze *above* the card dims the
   text, and a `backdrop-filter` there would blur the text with it). That override lives in
   one place in `client.js` with comments and knobs, and deleting it returns the plugin to
   pure layer-adding. Uninstalling leaves no styles behind.

## Compatibility

- **DSH**: `0.2.0-rc.2` and above (needs the `conversation.input.overlay` slot and the
  `theme/change` event from `ctx.theme`).
- **Platform**: Web client (desktop built-in browser / `dsh web`). CLI-only sessions are unaffected.
- **Engine**: Chromium family (Electron). Uses `backdrop-filter` and `color-mix()`.
- **Accessibility**: honours `prefers-reduced-motion` — all motion stops, the static glass remains.

## Development

```bash
node selftest.mjs                      # 19 assertions — stubs: module face, apply(), slot wiring
node livetest.mjs [react-umd-dir]      # 30 assertions — real React + real DOM: geometry, fail-closed
```

- **`selftest.mjs`** runs the client bundle against stubs: syntax, module face
  (`name`/`inject`/`apply`), `apply()` with and without services, slot registration target,
  stylesheet mounting, `theme/change` subscription, component rendering.
  Run it after any change to `client.js`: a client bundle that throws at top level can take
  down the web module system.
- **`livetest.mjs`** needs `react`/`react-dom`/`jsdom` (**deliberately not** in
  `package.json` dependencies, to keep the published package light). It mounts the glass
  layer into a real DOM with real React and verifies geometry anchoring (including the
  containing-block offset case), fail-closed behaviour, `data-busy` / `data-on` reacting to
  the running state, and clean unmount.

## Uninstall

```bash
dsh plugin --profile <your-profile> remove analog-liquid-glass-for-dsh
```

The composer returns to its original appearance; no styles are left behind.

## License

MIT
