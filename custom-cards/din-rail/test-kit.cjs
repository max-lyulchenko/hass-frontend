// Builds a kit to try the DIN rail cards in a real Home Assistant, without
// real breakers: test breakers (input_boolean), load and voltage sliders
// (input_number), template sensors for power, current and voltage, and a
// dashboard that uses them.
//   node custom-cards/din-rail/build.cjs && node custom-cards/din-rail/test-kit.cjs
// Output: custom-cards/din-rail/dist/din-rail-test-kit.zip
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const DIST = path.join(__dirname, "dist");
const CARD_FILE = "din-rail-cards.js";

// [id, name, phase, initial load (W), max current (A)]
const CIRCUITS = [
  ["kitchen", "Kitchen", 1, 850, 16],
  ["oven", "Oven", 1, 2400, 10],
  ["washer", "Washer", 1, 450, 16],
  ["dryer", "Dryer", 1, 0, 16],
  ["lights", "Lights", 2, 120, 10],
  ["sockets", "Sockets", 2, 300, 16],
  ["boiler", "Boiler", 2, 1500, 10],
  ["heat_pump", "Heat pump", 2, 2100, 20],
  ["garage", "Garage", 3, 60, 10],
  ["office", "Office", 3, 260, 16],
  ["garden", "Garden", 3, 0, 10],
  ["ev_charger", "EV charger", 3, 3600, 16],
];

const PHASES = [1, 2, 3];

const entity = {
  breaker: (id) => `input_boolean.din_test_${id}`,
  load: (id) => `input_number.din_test_${id}_load`,
  voltageSlider: (phase) => `input_number.din_test_l${phase}_voltage`,
  power: (id) => `sensor.din_test_${id}_power`,
  current: (id) => `sensor.din_test_${id}_current`,
  voltage: (id) => `sensor.din_test_${id}_voltage`,
};

const q = (text) => JSON.stringify(text);

const packageYaml = () => {
  const lines = [
    "# DIN rail cards test kit: test breakers and meters, no hardware needed.",
    "# Every entity id starts with din_test_. Delete this file to remove them.",
    "",
    "input_boolean:",
  ];
  for (const [id, name] of CIRCUITS) {
    lines.push(
      `  din_test_${id}:`,
      `    name: ${q(`DIN test ${name}`)}`,
      "    icon: mdi:electric-switch",
      "    initial: true"
    );
  }
  lines.push("", "input_number:");
  for (const phase of PHASES) {
    lines.push(
      `  din_test_l${phase}_voltage:`,
      `    name: ${q(`DIN test L${phase} voltage`)}`,
      "    min: 180",
      "    max: 270",
      "    step: 1",
      "    initial: 230",
      "    unit_of_measurement: V",
      "    mode: slider",
      "    icon: mdi:sine-wave"
    );
  }
  for (const [id, name, , load] of CIRCUITS) {
    lines.push(
      `  din_test_${id}_load:`,
      `    name: ${q(`DIN test ${name} load`)}`,
      "    min: 0",
      "    max: 7000",
      "    step: 10",
      `    initial: ${load}`,
      "    unit_of_measurement: W",
      "    mode: slider",
      "    icon: mdi:flash"
    );
  }
  lines.push("", "template:", "  - sensor:");
  for (const [id, name, phase] of CIRCUITS) {
    const on = `is_state('${entity.breaker(id)}', 'on')`;
    const volts = `states('${entity.voltageSlider(phase)}') | float(0)`;
    const watts = `(states('${entity.load(id)}') | float(0) if ${on} else 0)`;
    lines.push(
      `      - name: ${q(`DIN test ${name} power`)}`,
      `        unique_id: din_test_${id}_power`,
      "        device_class: power",
      "        state_class: measurement",
      "        unit_of_measurement: W",
      `        state: "{{ ${watts} }}"`,
      `      - name: ${q(`DIN test ${name} current`)}`,
      `        unique_id: din_test_${id}_current`,
      "        device_class: current",
      "        state_class: measurement",
      "        unit_of_measurement: A",
      `        state: "{% set v = ${volts} %}{{ (${watts} / v) | round(2) if v > 0 else 0 }}"`,
      `      - name: ${q(`DIN test ${name} voltage`)}`,
      `        unique_id: din_test_${id}_voltage`,
      "        device_class: voltage",
      "        state_class: measurement",
      "        unit_of_measurement: V",
      `        state: "{{ ${volts} }}"`
    );
  }
  return lines.join("\n") + "\n";
};

const module_ = ([id, name, , , maxCurrent]) => [
  `              - entity: ${entity.breaker(id)}`,
  `                name: ${q(name)}`,
  `                power_entity: ${entity.power(id)}`,
  `                current_entity: ${entity.current(id)}`,
  `                voltage_entity: ${entity.voltage(id)}`,
  `                max_current: ${maxCurrent}`,
];

const single = ([id, name, , , maxCurrent], extra) => [
  "          - type: custom:din-rail-switch-card",
  `            entity: ${entity.breaker(id)}`,
  `            name: ${q(name)}`,
  `            power_entity: ${entity.power(id)}`,
  `            current_entity: ${entity.current(id)}`,
  `            voltage_entity: ${entity.voltage(id)}`,
  `            max_current: ${maxCurrent}`,
  ...extra.map((line) => `            ${line}`),
];

const dashboardYaml = () => {
  const [kitchen, oven, , , , , , heatPump] = CIRCUITS;
  const lines = [
    "# Paste into a new dashboard: ⋮ → Edit dashboard → ⋮ → Raw configuration editor",
    "title: Breakers test",
    "views:",
    "  - title: Single breakers",
    "    path: single",
    "    type: sections",
    "    max_columns: 4",
    "    sections:",
    "      - type: grid",
    "        cards:",
    "          - type: heading",
    "            heading: Single breakers",
    ...single(kitchen, ["switch_style: din"]),
    ...single(oven, ["switch_style: button"]),
    ...single(kitchen, [
      "switch_style: din",
      "lcd_displays: true",
      "precision: 1",
    ]),
    ...single(heatPump, ["switch_style: button", "lcd_displays: true"]),
    "      - type: grid",
    "        cards:",
    "          - type: heading",
    "            heading: Controls",
    "          - type: entities",
    "            entities:",
    ...PHASES.map((p) => `              - ${entity.voltageSlider(p)}`),
    ...[kitchen, oven, heatPump].flatMap(([id]) => [
      `              - ${entity.breaker(id)}`,
      `              - ${entity.load(id)}`,
    ]),
    "  - title: Distribution board",
    "    path: board",
    "    type: sections",
    "    max_columns: 4",
    "    sections:",
    "      - type: grid",
    "        column_span: 4",
    "        cards:",
    "          - type: custom:din-rail-panel-card",
    "            title: One rail, DIN levers",
    "            columns: 12",
    "            switch_style: din",
    "            precision: 1",
    "            modules:",
    ...CIRCUITS.flatMap(module_),
    "          - type: custom:din-rail-panel-card",
    "            title: Three phases, buttons",
    "            columns: 4",
    "            switch_style: button",
    "            voltage_low: 215",
    "            voltage_high: 245",
    "            modules:",
    ...CIRCUITS.flatMap(module_),
    "      - type: grid",
    "        column_span: 4",
    "        cards:",
    "          - type: heading",
    "            heading: Controls",
    "          - type: entities",
    "            title: Phase voltages",
    "            entities:",
    ...PHASES.map((p) => `              - ${entity.voltageSlider(p)}`),
    "          - type: entities",
    "            title: Breakers",
    "            entities:",
    ...CIRCUITS.map(([id]) => `              - ${entity.breaker(id)}`),
    "          - type: entities",
    "            title: Loads",
    "            entities:",
    ...CIRCUITS.map(([id]) => `              - ${entity.load(id)}`),
  ];
  return lines.join("\n") + "\n";
};

(async () => {
  const cardPath = path.join(DIST, CARD_FILE);
  if (!fs.existsSync(cardPath)) {
    throw new Error(
      `Build the cards first: node ${path.relative(process.cwd(), path.join(__dirname, "build.cjs"))}`
    );
  }
  const zip = new JSZip();
  zip.file("INSTALL.md", fs.readFileSync(path.join(__dirname, "TEST-KIT.md")));
  zip.file(
    `www/community/din-rail-cards/${CARD_FILE}`,
    fs.readFileSync(cardPath)
  );
  zip.file("packages/din_rail_test.yaml", packageYaml());
  zip.file("dashboard.yaml", dashboardYaml());
  const zipPath = path.join(DIST, "din-rail-test-kit.zip");
  fs.writeFileSync(
    zipPath,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  );
  console.log(zipPath);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
