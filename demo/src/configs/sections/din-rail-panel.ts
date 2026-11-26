import type { DeviceRegistryEntry } from "../../../../src/data/device/device_registry";
import type { EntityInput } from "../../../../src/fake_data/entities/types";
import { baseDevice } from "../../stubs/device_registry";
import type { DinRailPanelCardConfig } from "../../../../src/panels/lovelace/cards/types";

// Circuits of a demo distribution board: name, state and power in W
const CIRCUITS: [id: string, name: string, on: boolean, power: number][] = [
  ["main", "Main", true, 4630],
  ["kitchen", "Kitchen", true, 1250.4],
  ["oven", "Oven", true, 2100],
  ["dishwasher", "Dishwasher", false, 0],
  ["washer", "Washer", true, 512.3],
  ["dryer", "Dryer", false, 0],
  ["living_room", "Living room", true, 86.2],
  ["bedrooms", "Bedrooms", true, 42.7],
  ["bathroom", "Bathroom", true, 1830],
  ["office", "Office", true, 215.9],
  ["garage", "Garage", false, 0],
  ["garden", "Garden", true, 12.4],
  ["heat_pump", "Heat pump", true, 2875.5],
  ["ev_charger", "EV charger", true, 11040],
  ["boiler", "Boiler", false, 0],
  ["outlets", "Outlets", true, 98.1],
];

const VOLTAGE = 231.4;

// Breaker ratings in A, 16 A unless listed. The bathroom is over its rating
// (7.9 A), to show the alarm.
const RATINGS: Record<string, number> = {
  main: 40,
  oven: 20,
  heat_pump: 20,
  ev_charger: 50,
  bathroom: 6,
  living_room: 10,
  bedrooms: 10,
  garden: 10,
};

// A device per circuit, so the more-info dialog of its entities finds it
export const demoDinRailPanelDevices: DeviceRegistryEntry[] = CIRCUITS.map(
  ([id, name]) => ({
    ...baseDevice,
    id: `demo_circuit_${id}`,
    name,
    manufacturer: "Demo",
    model: "Circuit breaker",
    config_entries: [],
    primary_config_entry: null,
    entry_type: null,
  })
);

export const demoDinRailPanelEntities: EntityInput[] = CIRCUITS.flatMap(
  ([id, name, on, power]) => {
    const device_id = `demo_circuit_${id}`;
    const sensor = (
      kind: string,
      state: number,
      unit: string
    ): EntityInput => ({
      entity_id: `sensor.circuit_${id}_${kind}`,
      state: String(state),
      device_id,
      attributes: {
        state_class: "measurement",
        unit_of_measurement: unit,
        device_class: kind,
        friendly_name: `${name} ${kind}`,
      },
    });
    return [
      {
        entity_id: `switch.circuit_${id}`,
        state: on ? "on" : "off",
        device_id,
        attributes: { friendly_name: name, icon: "mdi:electric-switch" },
      },
      sensor("power", power, "W"),
      sensor("current", Math.round((power / VOLTAGE) * 1000) / 1000, "A"),
      sensor("voltage", on ? VOLTAGE : 0, "V"),
      // The rating of the breaker, which the panel prints on it
      {
        entity_id: `number.circuit_${id}_over_current_threshold`,
        state: String(RATINGS[id] ?? 16),
        device_id,
        attributes: {
          unit_of_measurement: "A",
          min: 1,
          max: 63,
          step: 1,
          mode: "box",
          friendly_name: `${name} over current threshold`,
        },
      },
    ];
  }
);

// The panel on the home dashboard: one rail of different switches, all
// showing the readings of the electric meter
export const demoDinRailPanelDashboardCard: DinRailPanelCardConfig = {
  type: "din-rail-panel",
  title: "Distribution board",
  columns: 12,
  switch_style: "button",
  modules: CIRCUITS.slice(0, 12).map(([id], i) => ({
    entity: `switch.circuit_${id}`,
    power_entity: "sensor.electric_meter_power",
    current_entity: "sensor.electric_meter_current",
    voltage_entity: "sensor.eletric_meter_voltage",
    // Every fourth circuit is over its max current (3.44 A), to show the alarm
    max_current: i % 4 === 3 ? 3 : 16,
  })),
};

export const demoDinRailPanelCard: DinRailPanelCardConfig = {
  type: "din-rail-panel",
  title: "Distribution board",
  columns: 12,
  switch_style: "button",
  modules: CIRCUITS.map(([id]) => ({
    entity: `switch.circuit_${id}`,
    power_entity: `sensor.circuit_${id}_power`,
    current_entity: `sensor.circuit_${id}_current`,
    voltage_entity: `sensor.circuit_${id}_voltage`,
  })),
};
