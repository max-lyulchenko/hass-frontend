import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import {
  assert,
  assign,
  boolean,
  enums,
  number,
  object,
  optional,
  string,
} from "superstruct";
import { fireEvent } from "../../../../common/dom/fire_event";
import type { LocalizeFunc } from "../../../../common/translations/localize";
import "../../../../components/ha-form/ha-form";
import type {
  HaFormSchema,
  SchemaUnion,
} from "../../../../components/ha-form/types";
import type { HomeAssistant } from "../../../../types";
import { DIN_RAIL_SWITCH_DOMAINS } from "../../cards/hui-din-rail-switch-card";
import type {
  DinRailSwitchCardConfig,
  DinRailSwitchStyle,
} from "../../cards/types";
import {
  DEFAULT_VOLTAGE_HIGH,
  DEFAULT_VOLTAGE_LOW,
  LCD_MAX_PRECISION,
} from "../../common/format-lcd-value";
import type { LovelaceCardEditor } from "../../types";
import { baseLovelaceCardConfig } from "../structs/base-card-struct";
import { entityNameStruct } from "../structs/entity-name-struct";

const SWITCH_STYLES: DinRailSwitchStyle[] = ["din", "button"];

export const switchStyleStruct = enums(SWITCH_STYLES);

/** The select of the switch style, shared with the DIN rail panel editor. */
export const switchStyleSelector = (localize: LocalizeFunc) => ({
  select: {
    mode: "dropdown" as const,
    options: SWITCH_STYLES.map((style) => ({
      value: style,
      label: localize(
        `ui.panel.lovelace.editor.card.din-rail-switch.switch_style_options.${style}`
      ),
    })),
  },
});

export const precisionSelector = {
  number: { min: 0, max: LCD_MAX_PRECISION, step: 1, mode: "box" as const },
};

const voltageSelector = {
  number: {
    min: 0,
    max: 1000,
    step: 1,
    mode: "box" as const,
    unit_of_measurement: "V",
  },
};

/** Voltage limits of the LCD backlight, shared with the panel editor. */
export const voltageLimitsSchema = {
  name: "",
  type: "grid",
  schema: [
    { name: "voltage_low", selector: voltageSelector },
    { name: "voltage_high", selector: voltageSelector },
  ],
} as const satisfies HaFormSchema;

/**
 * The entities of each device, to offer only the entities of the device of a
 * breaker
 */
export const entitiesByDevice = (
  entities: HomeAssistant["entities"]
): Map<string, string[]> => {
  const byDevice = new Map<string, string[]>();
  for (const [entityId, entry] of Object.entries(entities)) {
    if (entry.device_id) {
      const ids = byDevice.get(entry.device_id) ?? [];
      ids.push(entityId);
      byDevice.set(entry.device_id, ids);
    }
  }
  return byDevice;
};

/** An entity selector that offers only `include`, when it is set. */
export const limitEntitySelector = <
  T extends { entity: Record<string, unknown> },
>(
  selector: T,
  include: string[] | undefined
): T =>
  include
    ? { ...selector, entity: { ...selector.entity, include_entities: include } }
    : selector;

// The device of a breaker: one with a switch
export const breakerDeviceSelector = {
  device: { entity: { domain: DIN_RAIL_SWITCH_DOMAINS } },
};

export const sensorSelector = (deviceClass: string) => ({
  entity: { filter: { domain: "sensor", device_class: deviceClass } },
});

export const switchEntitySelector = {
  entity: { filter: { domain: DIN_RAIL_SWITCH_DOMAINS } },
};

// The rating of a breaker: a number entity, as breakers report it, or a
// helper or a sensor
export const ratingEntitySelector = {
  entity: { filter: { domain: ["number", "input_number", "sensor"] } },
};

export const maxCurrentSelector = {
  number: {
    min: 0,
    max: 1000,
    step: 0.1,
    mode: "box" as const,
    unit_of_measurement: "A",
  },
};

export const VOLTAGE_LIMIT_DEFAULTS = {
  voltage_low: DEFAULT_VOLTAGE_LOW,
  voltage_high: DEFAULT_VOLTAGE_HIGH,
};

const cardConfigStruct = assign(
  baseLovelaceCardConfig,
  object({
    entity: optional(string()),
    device: optional(string()),
    name: optional(entityNameStruct),
    power_entity: optional(string()),
    current_entity: optional(string()),
    voltage_entity: optional(string()),
    lcd_displays: optional(boolean()),
    switch_style: optional(switchStyleStruct),
    precision: optional(number()),
    rating_entity: optional(string()),
    max_current: optional(number()),
    voltage_low: optional(number()),
    voltage_high: optional(number()),
    theme: optional(string()),
  })
);

@customElement("hui-din-rail-switch-card-editor")
export class HuiDinRailSwitchCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DinRailSwitchCardConfig;

  public setConfig(config: DinRailSwitchCardConfig): void {
    assert(config, cardConfigStruct);
    this._config = config;
  }

  private _entitiesByDevice = memoizeOne(entitiesByDevice);

  // With a device, the entity pickers offer only its entities
  private _schema = memoizeOne(
    (localize: LocalizeFunc, include: string[] | undefined) =>
      [
        { name: "device", selector: breakerDeviceSelector },
        {
          name: "entity",
          required: true,
          selector: limitEntitySelector(switchEntitySelector, include),
        },
        {
          name: "name",
          selector: { entity_name: {} },
          context: { entity: "entity" },
        },
        { name: "switch_style", selector: switchStyleSelector(localize) },
        {
          name: "power_entity",
          selector: limitEntitySelector(sensorSelector("power"), include),
        },
        {
          name: "current_entity",
          selector: limitEntitySelector(sensorSelector("current"), include),
        },
        {
          name: "voltage_entity",
          selector: limitEntitySelector(sensorSelector("voltage"), include),
        },
        {
          name: "rating_entity",
          selector: limitEntitySelector(ratingEntitySelector, include),
        },
        { name: "max_current", selector: maxCurrentSelector },
        { name: "lcd_displays", selector: { boolean: {} } },
        { name: "precision", selector: precisionSelector },
        voltageLimitsSchema,
        { name: "theme", selector: { theme: {} } },
      ] as const satisfies HaFormSchema[]
  );

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const data = {
      switch_style: "din",
      ...VOLTAGE_LIMIT_DEFAULTS,
      ...this._config,
    };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this._schema(
          this.hass.localize,
          this._config.device
            ? (this._entitiesByDevice(this.hass.entities).get(
                this._config.device
              ) ?? [])
            : undefined
        )}
        .computeLabel=${this._computeLabelCallback}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    fireEvent(this, "config-changed", { config: ev.detail.value });
  }

  private _computeLabelCallback = (
    schema: SchemaUnion<ReturnType<typeof this._schema>>
  ) => {
    switch (schema.name) {
      case "entity":
        return this.hass!.localize(
          "ui.panel.lovelace.editor.card.din-rail-switch.switch_entity"
        );
      case "power_entity":
      case "current_entity":
      case "voltage_entity":
      case "lcd_displays":
      case "switch_style":
      case "precision":
      case "device":
      case "rating_entity":
      case "max_current":
      case "voltage_low":
      case "voltage_high":
        return this.hass!.localize(
          `ui.panel.lovelace.editor.card.din-rail-switch.${schema.name}`
        );
      default:
        return this.hass!.localize(
          `ui.panel.lovelace.editor.card.generic.${schema.name}`
        );
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-din-rail-switch-card-editor": HuiDinRailSwitchCardEditor;
  }
}
