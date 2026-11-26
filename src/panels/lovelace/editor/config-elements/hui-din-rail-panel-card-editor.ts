import { mdiArrowDown, mdiArrowUp, mdiDelete } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
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
import "../../../../components/ha-button";
import "../../../../components/ha-expansion-panel";
import "../../../../components/ha-form/ha-form";
import "../../../../components/ha-icon-button";
import type {
  HaFormSchema,
  SchemaUnion,
} from "../../../../components/ha-form/types";
import type { HomeAssistant } from "../../../../types";
import {
  DIN_RAIL_PANEL_MAX_COLUMNS,
  DIN_RAIL_PANEL_MAX_RAILS,
} from "../../cards/hui-din-rail-panel-card";
import type {
  DinRailPanelCardConfig,
  DinRailPanelModuleConfig,
} from "../../cards/types";
import type { LovelaceCardEditor } from "../../types";
import { baseLovelaceCardConfig } from "../structs/base-card-struct";
import {
  breakerDeviceSelector,
  entitiesByDevice,
  limitEntitySelector,
  precisionSelector,
  sensorSelector,
  switchEntitySelector,
  switchStyleSelector,
  switchStyleStruct,
  maxCurrentSelector,
  ratingEntitySelector,
  VOLTAGE_LIMIT_DEFAULTS,
  voltageLimitsSchema,
} from "./hui-din-rail-switch-card-editor";

const moduleStruct = object({
  entity: optional(string()),
  device: optional(string()),
  name: optional(string()),
  power_entity: optional(string()),
  current_entity: optional(string()),
  voltage_entity: optional(string()),
  rating_entity: optional(string()),
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

// The form of a module. With a device, its entity pickers offer only the
// entities of that device (`include`).
const moduleSchema = (include: string[] | undefined) =>
  [
    { name: "device", selector: breakerDeviceSelector },
    {
      name: "entity",
      required: true,
      selector: limitEntitySelector(switchEntitySelector, include),
    },
    { name: "name", selector: { text: {} } },
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
  ] as const satisfies HaFormSchema[];

type ModuleSchema = ReturnType<typeof moduleSchema>;

// The key of the form of a module without a device
const NO_DEVICE: string[] = [];

@customElement("hui-din-rail-panel-card-editor")
export class HuiDinRailPanelCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DinRailPanelCardConfig;

  // The module whose form is open
  @state() private _expandedModule?: number;

  private _entitiesByDevice = memoizeOne(entitiesByDevice);

  // The forms of the modules, by the entities they offer
  private _moduleSchemas = new WeakMap<string[], ModuleSchema>();

  private _moduleSchema(module: DinRailPanelModuleConfig): ModuleSchema {
    const include = module.device
      ? (this._entitiesByDevice(this.hass!.entities).get(module.device) ?? [])
      : NO_DEVICE;
    let schema = this._moduleSchemas.get(include);
    if (!schema) {
      schema = moduleSchema(include === NO_DEVICE ? undefined : include);
      this._moduleSchemas.set(include, schema);
    }
    return schema;
  }

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
        @value-changed=${this._valueChanged}
      ></ha-form>
      ${this._renderModules()}
    `;
  }

  static styles = css`
    .modules {
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-2);
      margin-top: var(--ha-space-6);
    }
    .title {
      font-size: var(--ha-font-size-l);
      font-weight: var(--ha-font-weight-medium);
    }
    .helper {
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s);
    }
    .actions {
      display: flex;
      align-items: center;
      color: var(--secondary-text-color);
    }
    ha-expansion-panel ha-form {
      display: block;
      padding: var(--ha-space-2) 0 var(--ha-space-3);
    }
    ha-button {
      align-self: flex-start;
    }
  `;

  private _renderModules() {
    const localize = this.hass!.localize;
    const modules = this._config!.modules ?? [];
    const columns = this._config!.columns ?? DIN_RAIL_PANEL_MAX_COLUMNS;
    const full = modules.length >= columns * DIN_RAIL_PANEL_MAX_RAILS;
    return html`
      <div class="modules">
        <div class="title">
          ${localize("ui.panel.lovelace.editor.card.din-rail-panel.modules")}
        </div>
        <div class="helper">
          ${localize(
            "ui.panel.lovelace.editor.card.din-rail-panel.modules_helper",
            { rails: DIN_RAIL_PANEL_MAX_RAILS, columns }
          )}
        </div>
        ${modules.map(
          (module, index) => html`
            <ha-expansion-panel
              outlined
              .header=${this._moduleTitle(module, index)}
              .expanded=${this._expandedModule === index}
              data-index=${index}
              @expanded-changed=${this._moduleExpandedChanged}
            >
              <div slot="icons" class="actions" @click=${this._stopPropagation}>
                <ha-icon-button
                  .label=${localize(
                    "ui.panel.lovelace.editor.card.din-rail-panel.move_up"
                  )}
                  .path=${mdiArrowUp}
                  .disabled=${index === 0}
                  data-index=${index}
                  data-to=${index - 1}
                  @click=${this._moveModule}
                ></ha-icon-button>
                <ha-icon-button
                  .label=${localize(
                    "ui.panel.lovelace.editor.card.din-rail-panel.move_down"
                  )}
                  .path=${mdiArrowDown}
                  .disabled=${index === modules.length - 1}
                  data-index=${index}
                  data-to=${index + 1}
                  @click=${this._moveModule}
                ></ha-icon-button>
                <ha-icon-button
                  .label=${localize(
                    "ui.panel.lovelace.editor.card.din-rail-panel.remove_module"
                  )}
                  .path=${mdiDelete}
                  data-index=${index}
                  @click=${this._removeModule}
                ></ha-icon-button>
              </div>
              <ha-form
                .hass=${this.hass}
                .data=${module}
                .schema=${this._moduleSchema(module)}
                .computeLabel=${this._computeModuleLabel}
                data-index=${index}
                @value-changed=${this._moduleChanged}
              ></ha-form>
            </ha-expansion-panel>
          `
        )}
        <ha-button .disabled=${full} @click=${this._addModule}>
          ${localize("ui.panel.lovelace.editor.card.din-rail-panel.add_module")}
        </ha-button>
      </div>
    `;
  }

  private _moduleTitle(module: DinRailPanelModuleConfig, index: number) {
    const stateObj = module.entity
      ? this.hass!.states[module.entity]
      : undefined;
    return (
      module.name ||
      (stateObj ? this.hass!.formatEntityName(stateObj, undefined) : "") ||
      module.entity ||
      this.hass!.localize(
        "ui.panel.lovelace.editor.card.din-rail-panel.module",
        {
          number: index + 1,
        }
      )
    );
  }

  private _setModules(modules: DinRailPanelModuleConfig[]): void {
    fireEvent(this, "config-changed", {
      config: { ...this._config!, modules },
    });
  }

  private _moduleChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const index = Number((ev.currentTarget as HTMLElement).dataset.index);
    const modules = [...this._config!.modules];
    modules[index] = ev.detail.value;
    this._setModules(modules);
  }

  private _moduleExpandedChanged(ev: CustomEvent): void {
    const index = Number((ev.currentTarget as HTMLElement).dataset.index);
    if (ev.detail.expanded) {
      this._expandedModule = index;
    } else if (this._expandedModule === index) {
      this._expandedModule = undefined;
    }
  }

  private _addModule(): void {
    const modules = [...(this._config!.modules ?? []), { entity: "" }];
    this._expandedModule = modules.length - 1;
    this._setModules(modules);
  }

  private _moveModule(ev: Event): void {
    const { index, to } = (ev.currentTarget as HTMLElement).dataset;
    const modules = [...this._config!.modules];
    const [module] = modules.splice(Number(index), 1);
    modules.splice(Number(to), 0, module);
    if (this._expandedModule === Number(index)) {
      this._expandedModule = Number(to);
    }
    this._setModules(modules);
  }

  private _removeModule(ev: Event): void {
    const index = Number((ev.currentTarget as HTMLElement).dataset.index);
    const modules = this._config!.modules.filter((_, i) => i !== index);
    this._expandedModule = undefined;
    this._setModules(modules);
  }

  // The buttons of a module do not open or close its form
  private _stopPropagation(ev: Event): void {
    ev.stopPropagation();
  }

  private _computeModuleLabel = (schema: ModuleSchema[number]) => {
    switch (schema.name) {
      case "entity":
        return this.hass!.localize(
          "ui.panel.lovelace.editor.card.din-rail-switch.switch_entity"
        );
      case "name":
        return this.hass!.localize(
          "ui.panel.lovelace.editor.card.generic.name"
        );
      default:
        return this.hass!.localize(
          `ui.panel.lovelace.editor.card.din-rail-switch.${schema.name}`
        );
    }
  };

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
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-din-rail-panel-card-editor": HuiDinRailPanelCardEditor;
  }
}
