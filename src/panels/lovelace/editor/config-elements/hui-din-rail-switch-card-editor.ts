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
import { LCD_MAX_PRECISION } from "../../common/format-lcd-value";
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

const cardConfigStruct = assign(
  baseLovelaceCardConfig,
  object({
    entity: optional(string()),
    name: optional(entityNameStruct),
    power_entity: optional(string()),
    current_entity: optional(string()),
    voltage_entity: optional(string()),
    lcd_displays: optional(boolean()),
    switch_style: optional(switchStyleStruct),
    precision: optional(number()),
    theme: optional(string()),
  })
);

const sensorSelector = (deviceClass: string) => ({
  entity: { filter: { domain: "sensor", device_class: deviceClass } },
});

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

  private _schema = memoizeOne(
    (localize: LocalizeFunc) =>
      [
        {
          name: "entity",
          required: true,
          selector: {
            entity: { filter: { domain: DIN_RAIL_SWITCH_DOMAINS } },
          },
        },
        {
          name: "name",
          selector: { entity_name: {} },
          context: { entity: "entity" },
        },
        { name: "switch_style", selector: switchStyleSelector(localize) },
        { name: "power_entity", selector: sensorSelector("power") },
        { name: "current_entity", selector: sensorSelector("current") },
        { name: "voltage_entity", selector: sensorSelector("voltage") },
        { name: "lcd_displays", selector: { boolean: {} } },
        { name: "precision", selector: precisionSelector },
        { name: "theme", selector: { theme: {} } },
      ] as const satisfies HaFormSchema[]
  );

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const data = { switch_style: "din", ...this._config };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this._schema(this.hass.localize)}
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
