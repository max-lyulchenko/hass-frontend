import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { styleMap } from "lit/directives/style-map";
import memoizeOne from "memoize-one";
import { STATES_OFF } from "../../../common/const";
import { applyThemesOnElement } from "../../../common/dom/apply_themes_on_element";
import { fireEvent } from "../../../common/dom/fire_event";
import { stateColorCss } from "../../../common/entity/state_color";
import "../../../components/ha-card";
import { UNAVAILABLE } from "../../../data/entity/entity";
import { forwardHaptic } from "../../../data/haptics";
import type { HomeAssistant } from "../../../types";
import { toggleEntity } from "../common/entity/toggle-entity";
import { findEntities } from "../common/find-entities";
import { formatLcdValue, lcdPrecision } from "../common/format-lcd-value";
import { hasConfigChanged } from "../common/has-changed";
import "../components/hui-din-rail-button";
import "../components/hui-seven-segment";
import type {
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
} from "../types";
import {
  DIN_RAIL_SWITCH_DOMAINS,
  LCD_DIGITS,
  READINGS,
  findDeviceReadings,
} from "./hui-din-rail-switch-card";
import type { DinRailPanelCardConfig, DinRailPanelModuleConfig } from "./types";

export const DIN_RAIL_PANEL_MAX_COLUMNS = 12;
export const DIN_RAIL_PANEL_MAX_RAILS = 3;

const STUB_MODULES = 4;

@customElement("hui-din-rail-panel-card")
export class HuiDinRailPanelCard extends LitElement implements LovelaceCard {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("../editor/config-elements/hui-din-rail-panel-card-editor");
    return document.createElement("hui-din-rail-panel-card-editor");
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[]
  ): DinRailPanelCardConfig {
    const switches = findEntities(
      hass,
      STUB_MODULES,
      entities,
      entitiesFallback,
      DIN_RAIL_SWITCH_DOMAINS
    );
    return {
      type: "din-rail-panel",
      columns: DIN_RAIL_PANEL_MAX_COLUMNS,
      modules: switches.map((entity) => ({
        entity,
        ...findDeviceReadings(hass, entity),
      })),
    };
  }

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DinRailPanelCardConfig;

  private get _columns(): number {
    return Math.min(
      DIN_RAIL_PANEL_MAX_COLUMNS,
      Math.max(
        1,
        Math.round(this._config?.columns ?? DIN_RAIL_PANEL_MAX_COLUMNS)
      )
    );
  }

  public getCardSize(): number {
    return this._rails(this._config?.modules ?? [], this._columns).length * 3;
  }

  public getGridOptions(): LovelaceGridOptions {
    return {
      columns: "full",
      rows: "auto",
      min_columns: 12,
    };
  }

  public setConfig(config: DinRailPanelCardConfig): void {
    if (!Array.isArray(config.modules)) {
      throw new Error("Specify the modules of the panel");
    }
    const columns = Math.min(
      DIN_RAIL_PANEL_MAX_COLUMNS,
      Math.max(1, Math.round(config.columns ?? DIN_RAIL_PANEL_MAX_COLUMNS))
    );
    if (config.modules.length > columns * DIN_RAIL_PANEL_MAX_RAILS) {
      throw new Error(
        `A panel holds at most ${DIN_RAIL_PANEL_MAX_RAILS} rails of ${columns} modules`
      );
    }
    this._config = config;
  }

  private _rails = memoizeOne(
    (modules: DinRailPanelModuleConfig[], columns: number) => {
      const rails: DinRailPanelModuleConfig[][] = [];
      for (let i = 0; i < modules.length; i += columns) {
        rails.push(modules.slice(i, i + columns));
      }
      return rails.length ? rails : [[]];
    }
  );

  private _entityIds = memoizeOne((modules: DinRailPanelModuleConfig[]) =>
    modules.flatMap((module) =>
      [module.entity, ...READINGS.map(({ key }) => module[key])].filter(
        (id): id is string => Boolean(id)
      )
    )
  );

  // Show a display row only when a module of the panel uses it, so every
  // module of the panel lines up
  private _shownReadings = memoizeOne((modules: DinRailPanelModuleConfig[]) =>
    READINGS.filter(({ key }) => modules.some((module) => module[key]))
  );

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
    return this._entityIds(this._config.modules).some(
      (entityId) =>
        oldHass.states[entityId] !== this.hass!.states[entityId] ||
        oldHass.entities[entityId] !== this.hass!.entities[entityId]
    );
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }
    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    const oldConfig = changedProps.get("_config") as
      DinRailPanelCardConfig | undefined;
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
    const columns = this._columns;
    const rails = this._rails(this._config.modules, columns);
    const readings = this._shownReadings(this._config.modules);

    return html`
      <ha-card .header=${this._config.title}>
        <div class="enclosure" style=${styleMap({ "--columns": columns })}>
          ${rails.map(
            (rail) => html`
              <div class="rail">
                ${rail.map((module) => this._renderModule(module, readings))}
                ${Array.from(
                  { length: columns - rail.length },
                  () => html`<div class="cell"><div class="blank"></div></div>`
                )}
              </div>
            `
          )}
        </div>
      </ha-card>
    `;
  }

  private _renderModule(
    module: DinRailPanelModuleConfig,
    readings: ReturnType<typeof this._shownReadings>
  ) {
    const stateObj = module.entity
      ? (this.hass!.states[module.entity] as HassEntity | undefined)
      : undefined;
    const isOn = stateObj ? !STATES_OFF.includes(stateObj.state) : false;
    // All modules of a panel have the same switch
    const button = this._config!.switch_style === "button";
    const unavailable = !stateObj || stateObj.state === UNAVAILABLE;
    const name = stateObj
      ? this.hass!.formatEntityName(stateObj, module.name)
      : module.name || module.entity || "";
    const stateLabel = stateObj
      ? this.hass!.formatEntityState(stateObj)
      : this.hass!.localize("state.default.unavailable");

    return html`
      <div class="cell">
        <div
          class=${classMap({ module: true, on: isOn, unavailable })}
          style=${styleMap({
            "--active-color": stateObj ? stateColorCss(stateObj) : undefined,
          })}
        >
          <button
            class="label"
            data-entity-id=${module.entity}
            .disabled=${!stateObj}
            @click=${this._showMoreInfo}
            title=${name}
          >
            ${name}
          </button>
          ${
            readings.length
              ? html`
                  <div class="lcds">
                    ${readings.map(({ key }) => this._renderLcd(module[key]))}
                  </div>
                `
              : nothing
          }
          ${
            button
              ? html`
                  <div class="breaker">
                    <hui-din-rail-button
                      data-entity-id=${module.entity}
                      .on=${isOn}
                      .disabled=${unavailable}
                      .label=${`${name}: ${stateLabel}`}
                      @click=${this._toggle}
                    ></hui-din-rail-button>
                  </div>
                `
              : html`
                  <div class="breaker">
                    <span class="mark">I</span>
                    <button
                      class="slot"
                      role="switch"
                      aria-checked=${isOn ? "true" : "false"}
                      aria-label=${name}
                      title=${stateLabel}
                      data-entity-id=${module.entity}
                      .disabled=${unavailable}
                      @click=${this._toggle}
                    >
                      <span class="lever"></span>
                    </button>
                    <span class="mark">O</span>
                  </div>
                  <span class="flag"></span>
                `
          }
        </div>
      </div>
    `;
  }

  private _renderLcd(entityId: string | undefined) {
    if (!entityId) {
      // An unused display stays dark, so the modules of a rail line up
      return html`
        <span class="lcd-bezel">
          <span class="lcd">
            <hui-seven-segment
              class="lcd-digits"
              .digits=${LCD_DIGITS}
            ></hui-seven-segment>
            <span class="lcd-unit"></span>
          </span>
        </span>
      `;
    }
    const stateObj = this.hass!.states[entityId] as HassEntity | undefined;
    const lcd = formatLcdValue(
      stateObj ? Number(stateObj.state) : NaN,
      stateObj?.attributes.unit_of_measurement,
      LCD_DIGITS,
      lcdPrecision(this._config!.precision)
    );
    const valueText = stateObj
      ? this.hass!.formatEntityState(stateObj)
      : this.hass!.localize("state.default.unavailable");
    const label = stateObj
      ? this.hass!.formatEntityName(stateObj, undefined)
      : entityId;
    return html`
      <button
        class="lcd-bezel"
        data-entity-id=${entityId}
        @click=${this._showMoreInfo}
        aria-label=${`${label}: ${valueText}`}
        title=${`${label}: ${valueText}`}
      >
        <span class="lcd">
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

  private _toggle(ev: Event): void {
    const entityId = (ev.currentTarget as HTMLElement).dataset.entityId;
    if (!entityId || !this.hass?.states[entityId]) {
      return;
    }
    forwardHaptic(this, "light");
    toggleEntity(this.hass, entityId);
  }

  private _showMoreInfo(ev: Event): void {
    const entityId = (ev.currentTarget as HTMLElement).dataset.entityId;
    if (entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }
  }

  /*
   * Every module is drawn on a grid of 92 units wide, the unit (--u) being a
   * 92nd of the module width, so a module scales with the card. Modules stop
   * growing at 120px wide.
   *
   * Module height: padding 4 + label 11 + gap 4 + displays 3 x 21 + gaps 2 x 2
   * + gap 4 + switch + padding 6. The button switch is 20 units
   * high, the DIN switch twice that: mark 6 + gap 1 + slot 26 + gap 1
   * + mark 6 = 40 units.
   * Display width: digits 40 + gap 3 + unit 19 + padding 6 + bezel 4 = 72 of
   * the 84 units inside the module.
   */
  static styles = css`
    ha-card {
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
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
    button:disabled {
      cursor: default;
    }
    button:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 1px;
    }

    .enclosure {
      --module-max-width: 120px;
      --rail-padding: 10px;
      --module-gap: 2px;
      box-sizing: border-box;
      max-width: calc(
        var(--columns) * var(--module-max-width) + (var(--columns) - 1) *
          var(--module-gap) + 2 * var(--rail-padding) + 2 * var(--ha-space-3)
      );
      margin: 0 auto;
      padding: var(--ha-space-3);
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-3);
    }
    /* A rail: modules clipped on a metal DIN rail */
    .rail {
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
      gap: var(--module-gap);
      padding: var(--ha-space-2) var(--rail-padding);
      border-radius: var(--ha-border-radius-md, 8px);
      background: var(--secondary-background-color);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .rail::before {
      content: "";
      position: absolute;
      left: 2px;
      right: 2px;
      top: 50%;
      height: 24px;
      transform: translateY(-50%);
      border-radius: 2px;
      background: linear-gradient(#d6d6d6, #9c9c9c 45%, #8a8a8a 55%, #c4c4c4);
    }
    .cell {
      position: relative;
      container-type: inline-size;
      min-width: 0;
    }
    .blank {
      height: 100%;
      box-sizing: border-box;
      border-radius: 3px;
      border: 1px solid var(--divider-color);
      background: var(--ha-color-fill-neutral-quiet-resting, #e8e8e8);
      opacity: 0.6;
    }

    /* A module, drawn like a single pole DIN rail switch */
    .module {
      --u: calc(100cqi / 92);
      --module-color: var(--ha-color-fill-neutral-quiet-resting, #e8e8e8);
      --active-color: var(--state-active-color);
      position: relative;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: calc(4 * var(--u));
      padding: calc(4 * var(--u)) calc(3 * var(--u)) calc(6 * var(--u));
      border-radius: calc(3 * var(--u));
      border: 1px solid var(--divider-color);
      background: var(--module-color);
    }
    .module.unavailable {
      opacity: 0.5;
    }
    .label {
      width: 100%;
      font-size: calc(8 * var(--u));
      line-height: calc(11 * var(--u));
      font-weight: var(--ha-font-weight-medium);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lcds {
      align-self: stretch;
      display: flex;
      flex-direction: column;
      gap: calc(2 * var(--u));
    }
    .lcd-bezel {
      display: flex;
      padding: calc(2 * var(--u));
      border-radius: calc(3 * var(--u));
      background: linear-gradient(#4a4a4a, #2a2a2a);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
    .lcd {
      --seven-segment-on-color: #1d2614;
      --seven-segment-off-color: rgba(29, 38, 20, 0.08);
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: calc(3 * var(--u));
      padding: calc(2 * var(--u)) calc(3 * var(--u));
      border-radius: calc(1.5 * var(--u));
      background: linear-gradient(170deg, #c7d3a4, #a7b582);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
      color: #1d2614;
      font-family: var(--ha-font-family-code, monospace);
    }
    /* 4 digits of 27 by 36 units, plus 2 units of margin */
    .lcd-digits {
      flex: none;
      height: calc(13 * var(--u));
      width: calc(13 * var(--u) * 110 / 36);
    }
    .lcd-unit {
      flex: none;
      width: calc(19 * var(--u));
      font-size: calc(8 * var(--u));
      font-weight: bold;
      line-height: 1;
      text-align: start;
      white-space: nowrap;
    }

    .breaker {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--u);
    }
    hui-din-rail-button {
      --button-height: calc(20 * var(--u));
      --button-width: calc(64 * var(--u));
    }
    .mark {
      font-size: calc(6 * var(--u));
      font-weight: var(--ha-font-weight-bold);
      color: var(--secondary-text-color);
      line-height: calc(6 * var(--u));
    }
    .slot {
      position: relative;
      width: calc(14 * var(--u));
      height: calc(26 * var(--u));
      border-radius: calc(2 * var(--u));
      background: var(--primary-text-color);
      opacity: 0.85;
    }
    .lever {
      position: absolute;
      left: calc(1.5 * var(--u));
      right: calc(1.5 * var(--u));
      height: calc(12 * var(--u));
      top: calc(100% - 13.5 * var(--u));
      border-radius: calc(1.5 * var(--u));
      background: var(--card-background-color, #fff);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      transition: top 150ms ease-in-out;
    }
    .module.on .lever {
      top: calc(1.5 * var(--u));
    }
    .flag {
      position: absolute;
      bottom: calc(5 * var(--u));
      right: calc(5 * var(--u));
      width: calc(6 * var(--u));
      height: calc(6 * var(--u));
      border-radius: 50%;
      background: var(--state-inactive-color, var(--disabled-color));
    }
    .module.on .flag {
      background: var(--active-color);
      box-shadow: 0 0 calc(4 * var(--u)) var(--active-color);
    }
    @media (prefers-reduced-motion: reduce) {
      .lever {
        transition: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-din-rail-panel-card": HuiDinRailPanelCard;
  }
}
