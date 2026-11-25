import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators";

// Geometry of one digit in SVG units: width, height, segment thickness and
// the gap between segments. A digit cell also holds the decimal point.
const W = 20;
const H = 36;
const T = 4;
const GAP = 1;
const ADVANCE = W + 7;
const HT = T / 2;

const horizontal = (y: number) => {
  const x1 = HT + GAP;
  const x2 = W - HT - GAP;
  return `${x1},${y} ${x1 + HT},${y - HT} ${x2 - HT},${y - HT} ${x2},${y} ${x2 - HT},${y + HT} ${x1 + HT},${y + HT}`;
};

const vertical = (x: number, y1: number, y2: number) =>
  `${x},${y1} ${x + HT},${y1 + HT} ${x + HT},${y2 - HT} ${x},${y2} ${x - HT},${y2 - HT} ${x - HT},${y1 + HT}`;

const SEGMENTS = {
  a: horizontal(HT),
  b: vertical(W - HT, HT + GAP, H / 2 - GAP),
  c: vertical(W - HT, H / 2 + GAP, H - HT - GAP),
  d: horizontal(H - HT),
  e: vertical(HT, H / 2 + GAP, H - HT - GAP),
  f: vertical(HT, HT + GAP, H / 2 - GAP),
  g: horizontal(H / 2),
} as const;

type Segment = keyof typeof SEGMENTS;

const SEGMENT_NAMES = Object.keys(SEGMENTS) as Segment[];

const CHARACTERS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

interface Cell {
  segments: string;
  dot: boolean;
}

const toCells = (value: string, digits: number): Cell[] => {
  const cells: Cell[] = [];
  for (const char of value) {
    if (char === ".") {
      if (!cells.length) {
        cells.push({ segments: CHARACTERS["0"], dot: false });
      }
      cells[cells.length - 1].dot = true;
    } else if (char in CHARACTERS) {
      cells.push({ segments: CHARACTERS[char], dot: false });
    }
  }
  while (cells.length < digits) {
    cells.unshift({ segments: "", dot: false });
  }
  return cells;
};

/**
 * Shows a number on seven-segment digits, like an LCD. Unlit segments stay
 * faintly visible. Only digits, "-", " " and "." are drawn.
 */
@customElement("hui-seven-segment")
export class HuiSevenSegment extends LitElement {
  @property() public value = "";

  /** Minimum number of digits; the value is right aligned. */
  @property({ type: Number }) public digits = 5;

  protected render() {
    const cells = toCells(this.value, this.digits);
    const width = cells.length * ADVANCE;
    return html`
      <svg
        viewBox="-2 0 ${width + 2} ${H}"
        preserveAspectRatio="xMaxYMid meet"
        aria-hidden="true"
      >
        <g transform="skewX(-6) translate(${H * 0.1} 0)">
          ${cells.map(
            (cell, index) => svg`
              <g transform="translate(${index * ADVANCE} 0)">
                ${SEGMENT_NAMES.map(
                  (segment) => svg`<polygon
                    class=${cell.segments.includes(segment) ? "on" : "off"}
                    points=${SEGMENTS[segment]}
                  ></polygon>`
                )}
                <circle
                  class=${cell.dot ? "on" : "off"}
                  cx=${W + 3.5}
                  cy=${H - HT}
                  r=${HT}
                ></circle>
              </g>
            `
          )}
        </g>
      </svg>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .on {
      fill: var(--seven-segment-on-color, currentColor);
    }
    .off {
      fill: var(--seven-segment-off-color, transparent);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-seven-segment": HuiSevenSegment;
  }
}
