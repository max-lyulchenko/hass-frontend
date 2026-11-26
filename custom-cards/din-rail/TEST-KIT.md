# DIN rail cards: test kit

Try the breaker cards in your own Home Assistant without real breakers. The
kit adds 12 test breakers with sliders for their load and for the voltage of
3 phases, and a dashboard with every card variant.

Contents (the folders match your Home Assistant `config` folder):

| File                                             | What it is                            |
| ------------------------------------------------ | ------------------------------------- |
| `www/community/din-rail-cards/din-rail-cards.js` | The cards                             |
| `packages/din_rail_test.yaml`                    | Test entities, all named `din_test_…` |
| `dashboard.yaml`                                 | The test dashboard                    |

## 1. Copy the files

Copy the `www` and `packages` folders into your `config` folder (the one with
`configuration.yaml`), for example with the File editor or Studio Code Server
add-on, or the Samba share.

## 2. Turn on packages

Add this to `configuration.yaml`, unless you already have packages:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

If `configuration.yaml` already has a `homeassistant:` section, add only the
`packages:` line to it.

## 3. Restart

**Settings → System → Restart Home Assistant**. A restart is needed for
packages and for a new `www` folder. Afterwards **Settings → Devices &
services → Entities**, searching for `din_test`, shows the 12 breakers,
the sliders and 36 sensors.

## 4. Add the cards as a resource

1. **Settings → Dashboards → ⋮ (top right) → Resources → Add resource**.
   (No Resources item? Turn on **Advanced mode** in your user profile.)
2. URL: `/local/community/din-rail-cards/din-rail-cards.js?v=1`
3. Resource type: **JavaScript module**, then **Create**.
4. Reload the browser page (Ctrl+F5). The browser console shows a green
   `DIN-RAIL-CARDS` line when the cards are loaded.

## 5. Create the test dashboard

1. **Settings → Dashboards → Create dashboard → New dashboard from scratch**,
   name it `Breakers test`, and open it.
2. **✏️ (Edit) → ⋮ → Raw configuration editor**.
3. Replace everything with the contents of `dashboard.yaml`, **Save**, and
   close the editor.

## What to try

- **Single breakers** view: a DIN lever and a stand-by button, each in the
  simple and the LCD version.
- **Distribution board** view: 12 breakers on one rail with DIN levers, and
  the same breakers on 3 rails with buttons.
- Flip a breaker: its lever goes down (or the button turns red) and its power
  and current drop to 0.
- **Load** sliders: watch W switch to kW above 9999 W, and the current
  display turn red above the breaker's max current (Oven: 10 A, so above
  about 2300 W).
- **Phase voltage** sliders: below 210 V the displays turn gray, above 250 V
  red (the 3-rail board uses 215 V and 245 V).
- Edit any card to see its visual editor.

## Updating the cards

Replace `din-rail-cards.js`, then raise `?v=1` in the resource URL (to `?v=2`
and so on) so browsers load the new file, and reload the page.

## Rebuilding from source

From the root of the Home Assistant frontend repository, with Node.js 24 and
pnpm:

```sh
pnpm install                              # once
node custom-cards/din-rail/build.cjs      # the cards
node custom-cards/din-rail/test-kit.cjs   # this kit
```

The new `din-rail-test-kit.zip` is in `custom-cards/din-rail/dist/`. Copy
its `din-rail-cards.js` as in step 1 and update as described above. The
README of the cards has more details.

## Removing the kit

Delete the dashboard and the resource, delete
`packages/din_rail_test.yaml` and `www/community/din-rail-cards`, and restart.
