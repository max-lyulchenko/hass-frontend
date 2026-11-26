// A light stand-in for src/common/dom/apply_themes_on_element.ts, whose theme
// globals and colour library would make up most of the bundle. It applies the
// CSS variables of a user theme, in its light or dark mode, to the card.
import type { HomeAssistant } from "../../../src/types";

const applied = new WeakMap<HTMLElement, string[]>();

export const applyThemesOnElement = (
  element: HTMLElement,
  themes: HomeAssistant["themes"],
  selectedTheme?: string
) => {
  for (const name of applied.get(element) ?? []) {
    element.style.removeProperty(name);
  }
  applied.delete(element);

  const theme = selectedTheme ? themes?.themes?.[selectedTheme] : undefined;
  if (!theme) {
    return;
  }
  const { modes, ...base } = theme as Record<string, any>;
  const variables: Record<string, string> = {
    ...base,
    ...(modes?.[themes.darkMode ? "dark" : "light"] ?? {}),
  };
  const names: string[] = [];
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }
    const name = `--${key}`;
    element.style.setProperty(name, String(value));
    names.push(name);
  }
  applied.set(element, names);
};
