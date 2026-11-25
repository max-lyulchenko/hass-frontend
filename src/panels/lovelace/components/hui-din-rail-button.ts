import { mdiPower } from "@mdi/js";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators";
import "../../../components/ha-svg-icon";

/**
 * The horizontal push button of a smart DIN rail breaker, shaped like a pill.
 * Its stand-by symbol lights green when the switch is on and red when it is
 * off. Set `--button-height` and `--button-width` to size it.
 */
@customElement("hui-din-rail-button")
export class HuiDinRailButton extends LitElement {
  @property({ type: Boolean, reflect: true }) public on = false;

  @property({ type: Boolean }) public disabled = false;

  @property() public label = "";

  protected render() {
    return html`
      <button
        role="switch"
        aria-checked=${this.on ? "true" : "false"}
        aria-label=${this.label}
        title=${this.label}
        .disabled=${this.disabled}
      >
        <ha-svg-icon .path=${mdiPower}></ha-svg-icon>
      </button>
    `;
  }

  static styles = css`
    :host {
      --button-height: 18px;
      --button-width: 44px;
      --led-color: var(--red-color, #f44336);
      display: inline-flex;
    }
    :host([on]) {
      --led-color: var(--green-color, #4caf50);
    }
    button {
      width: var(--button-width);
      height: var(--button-height);
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border-radius: calc(var(--button-height) / 2);
      border: calc(var(--button-height) * 0.09) solid #8c8c8c;
      background: linear-gradient(#505050, #1b1b1b);
      box-shadow:
        0 calc(var(--button-height) * 0.06) calc(var(--button-height) * 0.1)
          rgba(0, 0, 0, 0.45),
        inset 0 0 0 calc(var(--button-height) * 0.05)
          color-mix(in srgb, var(--led-color) 45%, transparent);
      color: var(--led-color);
      cursor: pointer;
      transition: transform 80ms ease-in-out;
    }
    button:active:not(:disabled) {
      transform: scale(0.96);
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    button:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    ha-svg-icon {
      --mdc-icon-size: calc(var(--button-height) * 0.7);
      filter: drop-shadow(
        0 0 calc(var(--button-height) * 0.12) var(--led-color)
      );
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-din-rail-button": HuiDinRailButton;
  }
}
