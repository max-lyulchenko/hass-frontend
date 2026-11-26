import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import {
  array,
  assert,
  assign,
  boolean,
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
import {
  DIN_RAIL_PANEL_MAX_COLUMNS,
  DIN_RAIL_PANEL_MAX_RAILS,
} from "../../cards/hui-din-rail-panel-card";
import { DIN_RAIL_SWITCH_DOMAINS } from "../../cards/hui-din-rail-switch-card";
import type { DinRailPanelCardConfig } from "../../cards/types";
import type { LovelaceCardEditor } from "../../types";
import { baseLovelaceCardConfig } from "../structs/base-card-struct";
import {
  precisionSelector,
  switchStyleSelector,
  switchStyleStruct,
  maxCurrentSelector,
  VOLTAGE_LIMIT_DEFAULTS,
  voltageLimitsSchema,
} from "./hui-din-rail-switch-card-editor";

const moduleStruct = object({
  entity: optional(string()),
  name: optional(string()),
  power_entity: optional(string()),
  current_entity: optional(string()),
  voltage_entity: optional(string()),
  max_current: optional(number()),
});

const cardConfigStruct = assign(
  baseLovelaceCardConfig,
  object({
    title: optional(string()),
    columns: optional(number()),
    switch_style: optional(switchStyleStruct),
    precision: optional(number()),
    voltage_low: optional(number()),
    voltage_high: optional(number()),
    show_totals: optional(boolean()),
    total_power_entity: optional(string()),
    total_current_entity: optional(string()),
    total_voltage_entity: optional(string()),
    modules: array(moduleStruct),
    theme: optional(string()),
  })
);

const sensorSelector = (deviceClass: string) => ({
  entity: { filter: { domain: "sensor", device_class: deviceClass } },
});

@customElement("hui-din-rail-panel-card-editor")
export class HuiDinRailPanelCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DinRailPanelCardConfig;

  public setConfig(config: DinRailPanelCardConfig): void {
    assert(config, cardConfigStruct);
    this._config = config;
  }

  private _schema = memoizeOne(
    (localize: LocalizeFunc) =>
      [
        { name: "title", selector: { text: {} } },
        {
          name: "columns",
          selector: {
            number: {
              min: 1,
              max: DIN_RAIL_PANEL_MAX_COLUMNS,
              step: 1,
              mode: "slider",
            },
          },
        },
        {
          name: "modules",
          selector: {
            object: {
              multiple: true,
              reorder: true,
              label_field: "entity",
              fields: {
                entity: {
                  label: localize(
                    "ui.panel.lovelace.editor.card.din-rail-switch.switch_entity"
                  ),
                  required: true,
                  selector: {
                    entity: { filter: { domain: DIN_RAIL_SWITCH_DOMAINS } },
                  },
                },
                name: {
                  label: localize("ui.panel.lovelace.editor.card.generic.name"),
                  selector: { text: {} },
                },
                power_entity: {
                  label: localize(
                    "ui.panel.lovelace.editor.card.din-rail-switch.power_entity"
                  ),
                  selector: sensorSelector("power"),
                },
                current_entity: {
                  label: localize(
                    "ui.panel.lovelace.editor.card.din-rail-switch.current_entity"
                  ),
                  selector: sensorSelector("current"),
                },
                voltage_entity: {
                  label: localize(
                    "ui.panel.lovelace.editor.card.din-rail-switch.voltage_entity"
                  ),
                  selector: sensorSelector("voltage"),
                },
                max_current: {
                  label: localize(
                    "ui.panel.lovelace.editor.card.din-rail-switch.max_current"
                  ),
                  selector: maxCurrentSelector,
                },
              },
            },
          },
        },
        { name: "switch_style", selector: switchStyleSelector(localize) },
        { name: "precision", selector: precisionSelector },
        { name: "show_totals", selector: { boolean: {} } },
        { name: "total_power_entity", selector: sensorSelector("power") },
        { name: "total_current_entity", selector: sensorSelector("current") },
        { name: "total_voltage_entity", selector: sensorSelector("voltage") },
        voltageLimitsSchema,
        { name: "theme", selector: { theme: {} } },
      ] as const satisfies HaFormSchema[]
  );

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const data = {
      columns: DIN_RAIL_PANEL_MAX_COLUMNS,
      switch_style: "din",
      show_totals: true,
      ...VOLTAGE_LIMIT_DEFAULTS,
      ...this._config,
    };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this._schema(this.hass.localize)}
        .computeLabel=${this._computeLabelCallback}
        .computeHelper=${this._computeHelperCallback}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as DinRailPanelCardConfig;
    config.modules = config.modules ?? [];
    fireEvent(this, "config-changed", { config });
  }

  private _computeLabelCallback = (
    schema: SchemaUnion<ReturnType<typeof this._schema>>
  ) => {
    switch (schema.name) {
      case "switch_style":
      case "precision":
      case "voltage_low":
      case "voltage_high":
        return this.hass!.localize(
          `ui.panel.lovelace.editor.card.din-rail-switch.${schema.name}`
        );
      case "columns":
      case "modules":
      case "show_totals":
      case "total_power_entity":
      case "total_current_entity":
      case "total_voltage_entity":
        return this.hass!.localize(
          `ui.panel.lovelace.editor.card.din-rail-panel.${schema.name}`
        );
      default:
        return this.hass!.localize(
          `ui.panel.lovelace.editor.card.generic.${schema.name}`
        );
    }
  };

  private _computeHelperCallback = (
    schema: SchemaUnion<ReturnType<typeof this._schema>>
  ) =>
    schema.name === "modules"
      ? this.hass!.localize(
          "ui.panel.lovelace.editor.card.din-rail-panel.modules_helper",
          {
            rails: DIN_RAIL_PANEL_MAX_RAILS,
            columns: this._config?.columns ?? DIN_RAIL_PANEL_MAX_COLUMNS,
          }
        )
      : undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-din-rail-panel-card-editor": HuiDinRailPanelCardEditor;
  }
}
