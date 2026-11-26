# DIN Rail Cards

Two Lovelace cards that show switches as DIN rail equipment:

- **DIN rail switch** (`custom:din-rail-switch-card`): one breaker with power,
  current and voltage. It can also show them on retro LCD displays.
- **DIN rail panel** (`custom:din-rail-panel-card`): a distribution board with
  up to 3 rails of 12 modules.

Both cards have a visual editor.

## Manual installation

1. Copy `din-rail-cards.js` to `<config>/www/community/din-rail-cards/`.
2. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**:
   - URL: `/local/community/din-rail-cards/din-rail-cards.js?v=0.1.0`
   - Type: **JavaScript module**
3. Reload the browser (bump `?v=` after each update so the browser loads the
   new file).

With HACS installed, `/hacsfiles/din-rail-cards/din-rail-cards.js` also
serves the file.

## Configuration

```yaml
type: custom:din-rail-switch-card
entity: switch.main_breaker
power_entity: sensor.main_power
current_entity: sensor.main_current
voltage_entity: sensor.main_voltage
switch_style: din # din (vertical lever) or button (stand-by button)
lcd_displays: true # retro LCD displays
precision: 1 # 0-2 decimals on the LCD displays
rating_entity: number.main_breaker_over_current_threshold # optional, see below
max_current: 40 # optional: the current turns red above it (the rating by default)
```

```yaml
type: custom:din-rail-panel-card
title: Distribution board
columns: 12 # modules per rail, 1-12
switch_style: din # the same for all modules
precision: 0
show_totals: true # total power and current, average voltage (a sensor shared by modules counts once)
# Optional: show these sensors (a main meter, say) instead of the totals of the modules
total_power_entity: sensor.main_power
total_current_entity: sensor.main_current
total_voltage_entity: sensor.main_voltage
modules:
  - entity: switch.kitchen
    name: Kitchen
    power_entity: sensor.kitchen_power
    current_entity: sensor.kitchen_current
    voltage_entity: sensor.kitchen_voltage
    rating_entity: number.kitchen_over_current_threshold # optional, see below
    max_current: 16 # the current display turns red above it (the rating by default)
```

A breaker shows its rating above the switch, like the print on a real one:
the value in A of `rating_entity` (a number, input_number or sensor entity).
Without it, the card uses a number entity of the switch's device ending in
`_over_current_threshold`, or else `number.<switch>_over_current_threshold`
(`number.kitchen_over_current_threshold` for `switch.kitchen`), when there is
one. The rating is the max current unless `max_current` is set.

When the sensors are left out, the cards look for power, current and voltage
sensors on the device of the switch.

## Building from source

The cards are built from the Home Assistant frontend repository, which holds
their sources:

| Path                                                        | What it is                                  |
| ----------------------------------------------------------- | ------------------------------------------- |
| `src/panels/lovelace/cards/hui-din-rail-*-card.ts`          | The cards                                   |
| `src/panels/lovelace/editor/config-elements/hui-din-rail-*` | Their visual editors                        |
| `src/panels/lovelace/common/format-lcd-value.ts`            | LCD formatting, voltage and current limits  |
| `src/translations/en.json`                                  | Texts (`din-rail-switch`, `din-rail-panel`) |
| `custom-cards/din-rail/`                                    | This package: entry point, build scripts    |

You need Node.js 24 and pnpm (`corepack enable` sets it up). From the root of
the frontend repository:

```sh
pnpm install                              # once, and after dependencies change
node custom-cards/din-rail/build.cjs      # the cards
node custom-cards/din-rail/test-kit.cjs   # optional: the test kit (after build.cjs)
```

The files land in `custom-cards/din-rail/dist/`:

| File                    | What it is                                             |
| ----------------------- | ------------------------------------------------------ |
| `din-rail-cards.js`     | The cards, one file to copy to Home Assistant          |
| `din-rail-cards.zip`    | The cards, `hacs.json` and this README                 |
| `din-rail-test-kit.zip` | The cards, test entities, test dashboard and its guide |
| `modules.txt`           | The modules in the bundle, to check its size           |

Before a release, raise `VERSION` in `build.cjs`. The browser console shows it
when the cards load.

To install a new build, copy `din-rail-cards.js` over the old one in
`<config>/www/community/din-rail-cards/` and raise `?v=` in the resource URL.

Notes:

- On Windows, open the shell in the repository folder with an uppercase drive
  letter (`cd D:\HADev\hass-frontend`, not `d:\...`). A lowercase one can
  make the build fail on paths.
- The bundle leaves out Home Assistant elements that it already has, such as
  `ha-card` and `ha-form`, and takes texts from `en.json`, so a text change
  needs a new build too.
- To list every module separately in `modules.txt`, set `ANALYZE=1` before
  building (PowerShell: `$env:ANALYZE=1`).
