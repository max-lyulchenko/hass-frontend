// Standalone (HACS) entry for the DIN rail cards. It runs the in-tree cards
// as custom cards inside a production Home Assistant frontend:
// - the cards get custom tags and `custom:` types,
// - missing translations fall back to the bundled English strings,
// - HA elements that the frontend already defines are not defined again.
import { restoreDefine } from "./guard-define";
import { HuiDinRailPanelCard } from "../../../src/panels/lovelace/cards/hui-din-rail-panel-card";
import { HuiDinRailSwitchCard } from "../../../src/panels/lovelace/cards/hui-din-rail-switch-card";
import { HuiDinRailPanelCardEditor } from "../../../src/panels/lovelace/editor/config-elements/hui-din-rail-panel-card-editor";
import { HuiDinRailSwitchCardEditor } from "../../../src/panels/lovelace/editor/config-elements/hui-din-rail-switch-card-editor";
import type { HomeAssistant } from "../../../src/types";

declare const DIN_RAIL_TRANSLATIONS: Record<string, string>;
declare const DIN_RAIL_VERSION: string;

const SWITCH_TAG = "din-rail-switch-card";
const PANEL_TAG = "din-rail-panel-card";

// --- Translations -----------------------------------------------------------

const fallbackLocalize = (key: string, args: unknown[]): string => {
  let text = DIN_RAIL_TRANSLATIONS[key];
  if (text === undefined) {
    return "";
  }
  const values: Record<string, unknown> =
    args.length === 1 && typeof args[0] === "object" && args[0] !== null
      ? (args[0] as Record<string, unknown>)
      : Object.fromEntries(
          args.flatMap((arg, i) =>
            i % 2 === 0 ? [[String(arg), args[i + 1]]] : []
          )
        );
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
};

const wrapped = new WeakMap<HomeAssistant, HomeAssistant>();

const withFallbackLocalize = (hass: HomeAssistant | undefined) => {
  if (!hass) {
    return hass;
  }
  let result = wrapped.get(hass);
  if (!result) {
    const localize = ((key: string, ...args: unknown[]) =>
      (hass.localize as any)(key, ...args) ||
      fallbackLocalize(key, args)) as HomeAssistant["localize"];
    result = { ...hass, localize };
    wrapped.set(hass, result);
  }
  return result;
};

/** Give `hass` a localize that falls back to the bundled strings. */
const patchHass = (proto: object) => {
  let owner: object | null = proto;
  let descriptor: PropertyDescriptor | undefined;
  while (owner && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(owner, "hass");
    owner = Object.getPrototypeOf(owner);
  }
  if (!descriptor?.set || !descriptor.get) {
    throw new Error("DIN rail cards: hass is not an accessor");
  }
  const { get, set } = descriptor;
  Object.defineProperty(proto, "hass", {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      return get.call(this);
    },
    set(value: HomeAssistant | undefined) {
      set.call(this, withFallbackLocalize(value));
    },
  });
};

// --- Editors ----------------------------------------------------------------

// The editors use ha-form, which the HA frontend loads on demand. Loading the
// editor of a built-in card makes sure it is there.
const ensureHaForm = async () => {
  if (customElements.get("ha-form")) {
    return;
  }
  try {
    const helpers = await (window as any).loadCardHelpers?.();
    const card = await helpers?.createCardElement({ type: "tile" });
    await card?.constructor?.getConfigElement?.();
  } catch (_err) {
    // The editor still renders once ha-form is defined
  }
};

patchHass(HuiDinRailSwitchCardEditor.prototype);
patchHass(HuiDinRailPanelCardEditor.prototype);

// --- Cards ------------------------------------------------------------------

const toCustomType = <T extends { type: string }>(config: T, tag: string) => ({
  ...config,
  type: `custom:${tag}`,
});

class DinRailSwitchCard extends HuiDinRailSwitchCard {
  public static async getConfigElement() {
    await ensureHaForm();
    return super.getConfigElement();
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[]
  ) {
    return toCustomType(
      super.getStubConfig(hass, entities, entitiesFallback),
      SWITCH_TAG
    );
  }
}
patchHass(DinRailSwitchCard.prototype);

class DinRailPanelCard extends HuiDinRailPanelCard {
  public static async getConfigElement() {
    await ensureHaForm();
    return super.getConfigElement();
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[]
  ) {
    return toCustomType(
      super.getStubConfig(hass, entities, entitiesFallback),
      PANEL_TAG
    );
  }
}
patchHass(DinRailPanelCard.prototype);

restoreDefine();

if (!customElements.get(SWITCH_TAG)) {
  customElements.define(SWITCH_TAG, DinRailSwitchCard);
}
if (!customElements.get(PANEL_TAG)) {
  customElements.define(PANEL_TAG, DinRailPanelCard);
}

const customCards = ((window as any).customCards ||= []);
customCards.push(
  {
    type: SWITCH_TAG,
    name: fallbackLocalize(
      "ui.panel.lovelace.editor.card.din-rail-switch.name",
      []
    ),
    description: fallbackLocalize(
      "ui.panel.lovelace.editor.card.din-rail-switch.description",
      []
    ),
    preview: true,
  },
  {
    type: PANEL_TAG,
    name: fallbackLocalize(
      "ui.panel.lovelace.editor.card.din-rail-panel.name",
      []
    ),
    description: fallbackLocalize(
      "ui.panel.lovelace.editor.card.din-rail-panel.description",
      []
    ),
    preview: true,
  }
);

// eslint-disable-next-line no-console
console.info(
  `%c DIN-RAIL-CARDS %c ${DIN_RAIL_VERSION} `,
  "color: white; background: #0b6b3a; font-weight: 700",
  "color: #0b6b3a; background: white; font-weight: 700"
);

declare global {
  interface HTMLElementTagNameMap {
    "din-rail-switch-card": DinRailSwitchCard;
    "din-rail-panel-card": DinRailPanelCard;
  }
}
