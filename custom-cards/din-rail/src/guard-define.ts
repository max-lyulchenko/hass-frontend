// Imported first. While the bundle loads, defining a tag that the HA frontend
// already defined (like hui-warning) is skipped instead of throwing.
const originalDefine = customElements.define.bind(customElements);

customElements.define = (
  name: string,
  constructor: CustomElementConstructor,
  options?: ElementDefinitionOptions
) => {
  if (customElements.get(name)) {
    return;
  }
  originalDefine(name, constructor, options);
};

export const restoreDefine = () => {
  customElements.define = originalDefine;
};
