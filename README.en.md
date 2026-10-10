# dsh-liquid-glass-composer

> **Turn the DeepSeek Harness composer into a sheet of liquid glass.**

Specular top highlight, an inner white line, a rim light slowly orbiting the border.
Bubbles rise inside the glass while the model thinks. Light/dark switching eases over 1.7s.

![light](docs/light.png)
![dark](docs/dark.png)

## Install

```bash
dsh plugin --profile <your-profile> add dsh-liquid-glass-composer
```

From GitHub:

```bash
dsh plugin --profile <your-profile> add github:Siloet-phy/dsh-liquid-glass-composer
```

> The desktop build requires DSH to be **fully closed** while its package manager runs;
> restart after installing. The profile is usually `desktop` (desktop app) or `web` (`dsh web`).

## What it does

| Element | Detail |
|---|---|
| **Frosted glass** | White haze plus heavy blur — this is where the glass feel comes from, not a flat translucent fill |
| **Specular top highlight** | The soft light that makes glass readable as glass |
| **Inner white line** | A hairline along the top edge — Apple's most recognisable liquid-glass detail |
| **Rim light** | A 1.5px gradient edge slowly orbiting the border (one lap every 150s) |
| **Outer bloom** | Light spilling just past the edge of the glass |
| **Bubbles** | **Only while the model is thinking**: three bubbles a third of a cycle apart — one bursts, one is born |
| **Theme transition** | On light ↔ dark switch the glass interpolates **slower** than the page (1.7s vs 0.9s) |

## Two deliberate decisions

1. **No colour inside the glass.**
   Real liquid glass is nearly colourless: clear white glass, a whitened haze, and colour
   fringing at the edges. Colour belongs only on the rim highlights. Anything that puts a
   coloured blob *inside* the glass reads as coloured plastic.
2. **It never touches DSH's own composer styles or structure.**
   The plugin only *adds* a layer through a slot and matches its size via CSS variables.
   Native theming, font size, and layout updates cannot conflict with it, and uninstalling
   restores the composer untouched.

## Compatibility

- **DSH**: `0.2.0-rc.2` and above (needs the `conversation.input.overlay` slot and the
  `theme/change` event from `ctx.theme`).
- **Platform**: Web client (desktop built-in browser / `dsh web`). CLI-only sessions are unaffected.
- **Engine**: Chromium family (Electron).
- **Accessibility**: honours `prefers-reduced-motion` — all motion stops, the static glass remains.

## Development

```bash
node selftest.mjs
```

Runs the client bundle against stubs: syntax, module face (`name`/`inject`/`apply`),
`apply()` with and without services, slot registration target, stylesheet mounting,
`theme/change` subscription, and component rendering — 19 assertions.
Run it after any change to `client.js`: a client bundle that throws at top level can take
down the web module system.

## Uninstall

```bash
dsh plugin --profile <your-profile> remove dsh-liquid-glass-composer
```

The composer returns to its original appearance; no styles are left behind.

## License

MIT
