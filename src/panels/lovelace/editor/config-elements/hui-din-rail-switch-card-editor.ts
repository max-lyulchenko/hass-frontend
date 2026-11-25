import { assert, assign, boolean, object, optional, string } from "superstruct";
import type { LocalizeFunc } from "../../../../common/translations/localize";
import type { HaFormSchema } from "../../../../components/ha-form/types";
import { DIN_RAIL_SWITCH_DOMAINS } from "../../cards/hui-din-rail-switch-card";
import type { LovelaceConfigForm } from "../../types";
import { baseLovelaceCardConfig } from "../structs/base-card-struct";
import { entityNameStruct } from "../structs/entity-name-struct";

const struct = assign(
  baseLovelaceCardConfig,
  object({
    entity: optional(string()),
    name: optional(entityNameStruct),
    power_entity: optional(string()),
    current_entity: optional(string()),
    voltage_entity: optional(string()),
    lcd_displays: optional(boolean()),
    push_button: optional(boolean()),
    theme: optional(string()),
  })
);

const sensorSelector = (deviceClass: string) => ({
  entity: { filter: { domain: "sensor", device_class: deviceClass } },
});

const SCHEMA: HaFormSchema[] = [
  {
    name: "entity",
    required: true,
    selector: { entity: { filter: { domain: DIN_RAIL_SWITCH_DOMAINS } } },
  },
  {
    name: "name",
    selector: { entity_name: {} },
    context: { entity: "entity" },
  },
  { name: "power_entity", selector: sensorSelector("power") },
  { name: "current_entity", selector: sensorSelector("current") },
  { name: "voltage_entity", selector: sensorSelector("voltage") },
  { name: "lcd_displays", selector: { boolean: {} } },
  { name: "push_button", selector: { boolean: {} } },
  { name: "theme", selector: { theme: {} } },
];

const dinRailSwitchCardConfigForm: LovelaceConfigForm = {
  schema: SCHEMA,
  assertConfig: (config) => assert(config, struct),
  computeLabel: (schema: HaFormSchema, localize: LocalizeFunc) => {
    switch (schema.name) {
      case "entity":
        return localize(
          "ui.panel.lovelace.editor.card.din-rail-switch.switch_entity"
        );
      case "power_entity":
      case "current_entity":
      case "voltage_entity":
      case "lcd_displays":
      case "push_button":
        return localize(
          `ui.panel.lovelace.editor.card.din-rail-switch.${schema.name}`
        );
      default:
        return undefined;
    }
  },
};

export default dinRailSwitchCardConfigForm;
