// Builds the DIN rail cards as one custom card file and a HACS-style zip.
//   node custom-cards/din-rail/build.cjs
// Output: custom-cards/din-rail/dist/din-rail-cards.js and din-rail-cards.zip
const fs = require("fs");
const path = require("path");
const { rspack } = require("@rspack/core");
const JSZip = require("jszip");

const ROOT = path.resolve(__dirname, "../..");
const DIST = path.join(__dirname, "dist");
const FILENAME = "din-rail-cards.js";
const VERSION = "0.1.0";

// HA elements the frontend already defines: replaced by an empty module so
// they are neither bundled nor defined twice
const EMPTY = path.join(__dirname, "src/empty.ts");
const REPLACEMENTS = [
  [/[\\/]src[\\/]components[\\/]ha-card$/, EMPTY],
  [/[\\/]src[\\/]components[\\/]ha-svg-icon$/, EMPTY],
  [/[\\/]src[\\/]components[\\/]ha-alert$/, EMPTY],
  [/[\\/]src[\\/]components[\\/]ha-button$/, EMPTY],
  [/[\\/]src[\\/]components[\\/]ha-icon-button$/, EMPTY],
  [/[\\/]src[\\/]components[\\/]ha-form[\\/]ha-form$/, EMPTY],
  [/[\\/]src[\\/]panels[\\/]lovelace[\\/]cards[\\/]hui-error-card$/, EMPTY],
  // The real one bundles all theme globals and a colour library
  [
    /[\\/]src[\\/]common[\\/]dom[\\/]apply_themes_on_element$/,
    path.join(__dirname, "src/apply-themes.ts"),
  ],
];

const flatten = (object, prefix, out = {}) => {
  for (const [key, value] of Object.entries(object)) {
    const name = `${prefix}.${key}`;
    if (typeof value === "string") {
      out[name] = value;
    } else {
      flatten(value, name, out);
    }
  }
  return out;
};

// English strings of the cards, which a production HA does not have
const translations = () => {
  const lovelace = require(path.join(ROOT, "src/translations/en.json")).ui.panel
    .lovelace;
  return {
    ...flatten(
      lovelace.cards["din-rail-panel"],
      "ui.panel.lovelace.cards.din-rail-panel"
    ),
    ...flatten(
      lovelace.cards["din-rail-switch"],
      "ui.panel.lovelace.cards.din-rail-switch"
    ),
    ...flatten(
      lovelace.editor.card["din-rail-switch"],
      "ui.panel.lovelace.editor.card.din-rail-switch"
    ),
    ...flatten(
      lovelace.editor.card["din-rail-panel"],
      "ui.panel.lovelace.editor.card.din-rail-panel"
    ),
  };
};

const config = {
  mode: "production",
  context: ROOT,
  target: ["web", "es2021"],
  entry: path.join(__dirname, "src/index.ts"),
  devtool: false,
  output: {
    path: DIST,
    filename: FILENAME,
    module: false,
    iife: true,
    clean: true,
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
    minimize: true,
    concatenateModules: !process.env.ANALYZE,
  },
  resolve: {
    extensions: [".ts", ".js", ".json"],
    alias: { [path.join(ROOT, "src/util/empty.js")]: false },
  },
  module: {
    parser: {
      // One file: the editors are bundled instead of loaded on demand
      javascript: { dynamicImportMode: "eager" },
    },
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            target: "es2021",
            parser: { syntax: "typescript", decorators: true },
            transform: {
              legacyDecorator: true,
              useDefineForClassFields: false,
            },
          },
        },
        type: "javascript/auto",
      },
    ],
  },
  plugins: [
    // lit's package exports need the .js extension
    new rspack.NormalModuleReplacementPlugin(
      /^lit\/.+(?<!\.js)$/,
      (resource) => {
        resource.request = `${resource.request}.js`;
      }
    ),
    new rspack.NormalModuleReplacementPlugin(/^\.\.?\//, (resource) => {
      const full = path.resolve(resource.context, resource.request);
      const match = REPLACEMENTS.find(([re]) => re.test(full));
      if (match) {
        resource.request = match[1];
      }
    }),
    new rspack.DefinePlugin({
      DIN_RAIL_TRANSLATIONS: JSON.stringify(translations()),
      DIN_RAIL_VERSION: JSON.stringify(VERSION),
      __DEV__: "false",
      __DEMO__: "false",
      __BUILD__: JSON.stringify("latest"),
      __SUPERVISOR__: "false",
      __BACKWARDS_COMPAT__: "false",
      __STATIC_PATH__: JSON.stringify("/static/"),
      __HASS_URL__: JSON.stringify(""),
      __VERSION__: JSON.stringify(VERSION),
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
  ],
};

const run = () =>
  new Promise((resolve, reject) => {
    rspack(config, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      const info = stats.toJson({
        all: false,
        errors: true,
        warnings: true,
        modules: true,
        nestedModules: true,
      });
      if (stats.hasErrors()) {
        reject(new Error(info.errors.map((e) => e.message).join("\n\n")));
        return;
      }
      for (const warning of info.warnings) {
        console.warn("WARNING:", warning.message);
      }
      resolve(info);
    });
  });

(async () => {
  const info = await run();
  const modules = (info.modules || []).flatMap((m) =>
    m.modules ? m.modules.map((n) => n.name) : [m.name]
  );
  fs.writeFileSync(
    path.join(__dirname, "dist/modules.txt"),
    modules.sort().join("\n")
  );

  const js = fs.readFileSync(path.join(DIST, FILENAME));
  const zip = new JSZip();
  zip.file(FILENAME, js);
  zip.file("hacs.json", fs.readFileSync(path.join(__dirname, "hacs.json")));
  zip.file("README.md", fs.readFileSync(path.join(__dirname, "README.md")));
  const zipPath = path.join(DIST, "din-rail-cards.zip");
  fs.writeFileSync(
    zipPath,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  );
  console.log(
    `${FILENAME}: ${(js.length / 1024).toFixed(1)} KiB, ${modules.length} modules\n${zipPath}`
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
