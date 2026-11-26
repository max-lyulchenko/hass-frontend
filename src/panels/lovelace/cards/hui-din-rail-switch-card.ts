import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { styleMap } from "lit/directives/style-map";
import { STATES_OFF } from "../../../common/const";
import { UNAVAILABLE } from "../../../data/entity/entity";
import { applyThemesOnElement } from "../../../common/dom/apply_themes_on_element";
import { fireEvent } from "../../../common/dom/fire_event";
import { computeDomain } from "../../../common/entity/compute_domain";
import { stateColorCss } from "../../../common/entity/state_color";
import "../../../components/ha-card";
import { forwardHaptic } from "../../../data/haptics";
import type { HomeAssistant } from "../../../types";
import { toggleEntity } from "../common/entity/toggle-entity";
import { findEntities } from "../common/find-entities";
import {
  currentAboveMax,
  formatLcdValue,
  lcdPrecision,
  voltageLevel,
} from "../common/format-lcd-value";
import { hasConfigChanged } from "../common/has-changed";
import "../components/hui-din-rail-button";
import "../components/hui-seven-segment";
import { createEntityNotFoundWarning } from "../components/hui-warning";
import type {
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
} from "../types";
import type { DinRailSwitchCardConfig, DinRailSwitchStyle } from "./types";

export const DIN_RAIL_SWITCH_DOMAINS = ["switch", "input_boolean", "light"];

export const READINGS = [
  { key: "power_entity", deviceClass: "power", label: "power" },
  { key: "current_entity", deviceClass: "current", label: "current" },
  { key: "voltage_entity", deviceClass: "voltage", label: "voltage" },
] as const;

export const LCD_DIGITS = 4;

/**
 * Backlight of the LCD displays, set on their container: green-yellow, gray
 * (`.low`) when the voltage is below the low limit and red (`.high`) when it
 * is above the high limit. A single display can be colored the same way
 * (`.lcd.low`, `.lcd.high`), and is red above its max (`.lcd.alarm`, the
 * current).
 */
export const lcdBacklight = css`
  .lcds {
    --lcd-backlight: linear-gradient(170deg, #c7d3a4, #a7b582);
    --lcd-ink: #1d2614;
    --lcd-ink-off: rgba(29, 38, 20, 0.08);
  }
  .lcds.low,
  .lcd.low {
    --lcd-backlight: linear-gradient(170deg, #b4b6b1, #8f928c);
    --lcd-ink: #1f201e;
    --lcd-ink-off: rgba(31, 32, 30, 0.08);
  }
  .lcds.high,
  .lcd.high,
  .lcd.alarm {
    --lcd-backlight: linear-gradient(170deg, #f08a73, #cf4a35);
    --lcd-ink: #2b0b06;
    --lcd-ink-off: rgba(43, 11, 6, 0.1);
  }
`;

export type ReadingKey = (typeof READINGS)[number]["key"];
type ReadingLabel = (typeof READINGS)[number]["label"];

/**
 * Find the power, current and voltage sensors of the device of a switch, as
 * a metering plug or a DIN rail relay reports them next to its switch.
 */
export const findDeviceReadings = (
  hass: HomeAssistant,
  entityId: string
): Partial<Record<ReadingKey, string>> => {
  const readings: Partial<Record<ReadingKey, string>> = {};
  const deviceId = entityId ? hass.entities[entityId]?.device_id : undefined;
  if (!deviceId) {
    return readings;
  }
  const sensorIds = Object.keys(hass.states).filter(
    (id) =>
      computeDomain(id) === "sensor" &&
      hass.entities[id]?.device_id === deviceId
  );
  for (const { key, deviceClass } of READINGS) {
    const match = sensorIds.find(
      (id) => hass.states[id].attributes.device_class === deviceClass
    );
    if (match) {
      readings[key] = match;
    }
  }
  return readings;
};

@customElement("hui-din-rail-switch-card")
export class HuiDinRailSwitchCard extends LitElement implements LovelaceCard {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("../editor/config-elements/hui-din-rail-switch-card-editor");
    return document.createElement("hui-din-rail-switch-card-editor");
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[]
  ): DinRailSwitchCardConfig {
    const [entity = ""] = findEntities(
      hass,
      1,
      entities,
      entitiesFallback,
      DIN_RAIL_SWITCH_DOMAINS
    );
    return {
      type: "din-rail-switch",
      entity,
      ...findDeviceReadings(hass, entity),
    };
  }

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DinRailSwitchCardConfig;

  private get _switchStyle(): DinRailSwitchStyle {
    return this._config?.switch_style === "button" ? "button" : "din";
  }

  // The LCD version needs 4 rows with a DIN switch and 3 with a button,
  // see the sizes in the styles
  private get _rows(): number {
    if (!this._config?.lcd_displays) {
      return 3;
    }
    return this._switchStyle === "button" ? 3 : 4;
  }

  public getCardSize(): number {
    return this._rows;
  }

  public getGridOptions(): LovelaceGridOptions {
    const rows = this._rows;
    return {
      columns: 6,
      rows,
      min_columns: 6,
      min_rows: rows,
    };
  }

  public setConfig(config: DinRailSwitchCardConfig): void {
    if (
      !config.entity ||
      !DIN_RAIL_SWITCH_DOMAINS.includes(computeDomain(config.entity))
    ) {
      throw new Error(
        `Specify an entity from one of these domains: ${DIN_RAIL_SWITCH_DOMAINS.join(", ")}`
      );
    }
    this._config = config;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._config) {
      return false;
    }
    if (hasConfigChanged(this, changedProps)) {
      return true;
    }
    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    if (!oldHass || !this.hass) {
      return changedProps.has("hass");
    }
    return [
      this._config.entity,
      ...READINGS.map(({ key }) => this._config![key]),
    ].some(
      (entityId) =>
        entityId !== undefined &&
        (oldHass.states[entityId] !== this.hass!.states[entityId] ||
          oldHass.entities[entityId] !== this.hass!.entities[entityId])
    );
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }
    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    const oldConfig = changedProps.get("_config") as
      DinRailSwitchCardConfig | undefined;
    if (
      !oldHass ||
      !oldConfig ||
      oldHass.themes !== this.hass.themes ||
      oldConfig.theme !== this._config.theme
    ) {
      applyThemesOnElement(this, this.hass.themes, this._config.theme);
    }
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }

    const stateObj = this.hass.states[this._config.entity] as
      HassEntity | undefined;

    if (!stateObj) {
      return html`
        <hui-warning>
          ${createEntityNotFoundWarning(this.hass.localize, this.hass.config)}
        </hui-warning>
      `;
    }

    const isOn = !STATES_OFF.includes(stateObj.state);
    const unavailable = stateObj.state === UNAVAILABLE;
    const name = this.hass.formatEntityName(stateObj, this._config.name);
    const stateLabel = this.hass.formatEntityState(stateObj);

    const module = html`
      <div
        class=${classMap({
          module: true,
          on: isOn,
          unavailable,
          button: this._switchStyle === "button",
        })}
        style=${styleMap({ "--active-color": stateColorCss(stateObj) })}
      >
        ${
          this._switchStyle === "button"
            ? html`
                <hui-din-rail-button
                  .on=${isOn}
                  .disabled=${unavailable}
                  .label=${`${name}: ${stateLabel}`}
                  @click=${this._toggle}
                ></hui-din-rail-button>
              `
            : html`
                <span class="mark">I</span>
                <button
                  class="slot"
                  role="switch"
                  aria-checked=${isOn ? "true" : "false"}
                  aria-label=${name}
                  title=${stateLabel}
                  .disabled=${unavailable}
                  @click=${this._toggle}
                >
                  <span class="lever"></span>
                </button>
                <span class="mark">O</span>
                <span class="flag"></span>
              `
        }
      </div>
    `;

    return html`
      <ha-card class=${classMap({ "lcd-mode": !!this._config.lcd_displays })}>
        <div class="header">
          <button class="name" @click=${this._showMoreInfo} title=${name}>
            ${name}
          </button>
          <span class="state">${stateLabel}</span>
        </div>
        ${
          this._config.lcd_displays
            ? html`
                <div class="lcds ${this._voltageLevel() ?? ""}">
                  ${READINGS.map(({ key, label }) => this._renderLcd(key, label))}
                </div>
                <div class="switch-row">${module}</div>
              `
            : html`
                <div class="content">
                  ${module}
                  <div class="readings">
                    ${READINGS.map(({ key, label }) =>
                      this._renderReading(key, label)
                    )}
                  </div>
                </div>
              `
        }
      </ha-card>
    `;
  }

  // The backlight of the displays: gray below the low voltage, red above the
  // high one
  private _voltageLevel() {
    const entityId = this._config!.voltage_entity;
    const stateObj = entityId ? this.hass!.states[entityId] : undefined;
    return stateObj
      ? voltageLevel(
          Number(stateObj.state),
          stateObj.attributes.unit_of_measurement,
          this._config!.voltage_low,
          this._config!.voltage_high
        )
      : undefined;
  }

  // The current display turns red above the max current
  private _currentAlarm(key: ReadingKey) {
    const entityId = this._config![key];
    const stateObj = entityId ? this.hass!.states[entityId] : undefined;
    return (
      key === "current_entity" &&
      !!stateObj &&
      currentAboveMax(
        Number(stateObj.state),
        stateObj.attributes.unit_of_measurement,
        this._config!.max_current
      )
    );
  }

  private _renderLcd(key: ReadingKey, label: ReadingLabel) {
    const entityId = this._config![key];
    if (!entityId) {
      return nothing;
    }
    const stateObj = this.hass!.states[entityId] as HassEntity | undefined;
    const labelText = this.hass!.localize(
      `ui.panel.lovelace.cards.din-rail-switch.${label}`
    );
    // Like a panel meter, the display has 4 digits and switches between
    // prefixes (W, kW, MW, ...). Its decimal point is always ".", so the value
    // is not formatted for the locale here.
    const lcd = formatLcdValue(
      stateObj ? Number(stateObj.state) : NaN,
      stateObj?.attributes.unit_of_measurement,
      LCD_DIGITS,
      lcdPrecision(this._config!.precision)
    );
    const valueText = stateObj
      ? this.hass!.formatEntityState(stateObj)
      : this.hass!.localize("state.default.unavailable");
    return html`
      <button
        class="lcd-bezel"
        data-entity-id=${entityId}
        @click=${this._showReadingMoreInfo}
        aria-label=${`${labelText}: ${valueText}`}
        title=${valueText}
      >
        <span class=${classMap({ lcd: true, alarm: this._currentAlarm(key) })}>
          <span class="lcd-label">${labelText}</span>
          <hui-seven-segment
            class="lcd-digits"
            .value=${lcd.digits}
            .digits=${LCD_DIGITS}
          ></hui-seven-segment>
          <span class="lcd-unit">${lcd.unit}</span>
        </span>
      </button>
    `;
  }

  private _renderReading(key: ReadingKey, label: ReadingLabel) {
    const entityId = this._config![key];
    if (!entityId) {
      return nothing;
    }
    const stateObj = this.hass!.states[entityId] as HassEntity | undefined;
    // With a max current, the current is red above it and green below
    const checked =
      key === "current_entity" &&
      this._config!.max_current !== undefined &&
      !!stateObj &&
      !Number.isNaN(Number(stateObj.state));
    const alarm = checked && this._currentAlarm(key);
    return html`
      <button
        class=${classMap({ reading: true, ok: checked && !alarm, alarm })}
        data-entity-id=${entityId}
        @click=${this._showReadingMoreInfo}
      >
        <span class="label">
          ${this.hass!.localize(`ui.panel.lovelace.cards.din-rail-switch.${label}`)}
        </span>
        <span class="value">
          ${
            stateObj
              ? this.hass!.formatEntityState(stateObj)
              : this.hass!.localize("state.default.unavailable")
          }
        </span>
      </button>
    `;
  }

  private _toggle(): void {
    forwardHaptic(this, "light");
    toggleEntity(this.hass!, this._config!.entity);
  }

  private _showMoreInfo(): void {
    fireEvent(this, "hass-more-info", { entityId: this._config!.entity });
  }

  private _showReadingMoreInfo(ev: Event): void {
    const entityId = (ev.currentTarget as HTMLElement).dataset.entityId;
    if (entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }
  }

  static styles = css`
    ha-card {
      height: 100%;
      box-sizing: border-box;
      padding: var(--ha-space-3) var(--ha-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-3);
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ha-space-2);
      min-width: 0;
    }
    .name {
      font-size: var(--ha-font-size-l);
      font-weight: var(--ha-font-weight-medium);
      text-align: start;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .state {
      flex: none;
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s);
    }
    .content {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--ha-space-4);
      min-height: 0;
    }

    /*
     * The breaker module, drawn like a single pole DIN rail switch.
     * A button module is 8 + button 18 + 8 + border 2 = 36px high. A DIN
     * module is twice that: 4 + mark 8 + 2 + slot 42 + 2 + mark 8 + 4
     * + border 2 = 72px.
     */
    .module {
      --module-color: var(--ha-color-fill-neutral-quiet-resting, #e8e8e8);
      --active-color: var(--state-active-color);
      flex: none;
      width: 56px;
      align-self: center;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 4px 0;
      border-radius: var(--ha-border-radius-md, 8px);
      background: var(--module-color);
      border: 1px solid var(--divider-color);
      position: relative;
    }
    .module.button {
      padding: 8px 0;
    }
    .mark {
      font-size: 8px;
      font-weight: var(--ha-font-weight-bold);
      color: var(--secondary-text-color);
      line-height: 8px;
    }
    .slot {
      position: relative;
      width: 22px;
      height: 42px;
      border-radius: var(--ha-border-radius-sm, 4px);
      background: var(--primary-text-color);
      opacity: 0.85;
    }
    .slot:disabled {
      cursor: not-allowed;
    }
    .lever {
      position: absolute;
      left: 2px;
      right: 2px;
      height: 20px;
      top: calc(100% - 22px);
      border-radius: 3px;
      background: var(--card-background-color, #fff);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      transition: top 150ms ease-in-out;
    }
    .module.on .lever {
      top: 2px;
    }
    .flag {
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--state-inactive-color, var(--disabled-color));
    }
    .module.on .flag {
      background: var(--active-color);
      box-shadow: 0 0 6px var(--active-color);
    }
    .module.unavailable {
      opacity: 0.5;
    }
    @media (prefers-reduced-motion: reduce) {
      .lever {
        transition: none;
      }
    }

    .readings {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-1);
    }
    .reading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ha-space-2);
      padding: var(--ha-space-1) 0;
      border-bottom: 1px solid var(--divider-color);
      text-align: start;
    }
    .reading:last-child {
      border-bottom: none;
    }
    .label {
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s);
    }
    .value {
      font-size: var(--ha-font-size-l);
      font-weight: var(--ha-font-weight-medium);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .reading.ok .value {
      color: var(--success-color, #43a047);
    }
    .reading.alarm .value {
      color: var(--error-color, #db4437);
    }

    /*
     * Retro LCD displays, like the panel meters of the 80s and 90s.
     * Sized to fit a card of 6 columns, which can be as
     * narrow as 156px: padding 20 + header 18 + gap 8 + displays 3 x 25
     * + gaps 8 + gap 8 + switch.
     * With a DIN switch (72px) the card is 209px high and fits 4 rows
     * (248px). With a button (36px) it is 173px and fits 3 rows (184px).
     */
    ha-card.lcd-mode {
      padding: 10px;
      gap: 8px;
      overflow: hidden;
    }
    .lcd-mode .name {
      font-size: 14px;
      line-height: 18px;
    }
    .lcd-mode .state {
      font-size: 11px;
    }
    .lcds {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .lcd-bezel {
      display: flex;
      min-width: 0;
      padding: 2px;
      border-radius: 4px;
      background: linear-gradient(#4a4a4a, #2a2a2a);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.15),
        0 1px 2px rgba(0, 0, 0, 0.3);
    }
    ${lcdBacklight}
    .lcd {
      --seven-segment-on-color: var(--lcd-ink);
      --seven-segment-off-color: var(--lcd-ink-off);
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 5px;
      border-radius: 2px;
      background: var(--lcd-backlight);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.45);
      color: var(--lcd-ink);
      font-family: var(--ha-font-family-code, monospace);
      text-align: start;
    }
    .lcd-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 8px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    /* 4 digits of 27 by 36 units, plus 2 units of margin */
    .lcd-digits {
      flex: none;
      height: 15px;
      width: calc(15px * 110 / 36);
    }
    .lcd-unit {
      flex: none;
      width: 2.2em;
      font-size: 11px;
      font-weight: bold;
      line-height: 1;
    }
    .switch-row {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-din-rail-switch-card": HuiDinRailSwitchCard;
  }
}
