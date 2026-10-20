/**
 * Erzeugt das Rückfall-Farbschema der App (Geräte ohne Dynamic Color) aus einem Farbton:
 * Material-3-Schema „tonalSpot“ (wie Dynamic Color im Alltag), Hell und Dunkel, Standardkontrast.
 * Ausgabe: Kotlin für `ui/theme/RueckfallFarben.kt`.
 *
 * Die Bibliothek ist Googles material-color-utilities (Apache 2.0), Version 0.3.0 (0.4.0 lässt sich als
 * ES-Modul nicht laden, Importe ohne Dateiendung). Sie gehört nicht ins Repo und nicht
 * in die App, sie wird nur zum Erzeugen in einen leeren Ordner geladen (sh, aus dem Repo-Wurzelordner):
 *   T=$(mktemp -d) && (cd "$T" && npm init -y >/dev/null \
 *     && npm install --ignore-scripts --no-audit --no-fund @material/material-color-utilities@0.3.0)
 *   node scripts/rueckfall-farben.mjs "$T/node_modules/@material/material-color-utilities" 2F667A \
 *     > app/src/main/java/app/kiumu/accura/ui/theme/RueckfallFarben.kt
 */
import { pathToFileURL } from "node:url";

const [libDir, seedHex = "2F667A"] = process.argv.slice(2);
if (!libDir) {
  console.error("Aufruf: node scripts/rueckfall-farben.mjs <pfad/zu/material-color-utilities> [RRGGBB]");
  process.exit(1);
}
const { Hct, MaterialDynamicColors, SchemeTonalSpot, argbFromHex } = await import(pathToFileURL(`${libDir}/index.js`).href);

// Reihenfolge und Namen wie die Parameter von lightColorScheme/darkColorScheme in Compose Material 3.
const roles = [
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer", "inversePrimary",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "background", "onBackground", "surface", "onSurface", "surfaceVariant", "onSurfaceVariant",
  "surfaceTint", "inverseSurface", "inverseOnSurface",
  "error", "onError", "errorContainer", "onErrorContainer",
  "outline", "outlineVariant", "scrim",
  "surfaceBright", "surfaceContainer", "surfaceContainerHigh", "surfaceContainerHighest",
  "surfaceContainerLow", "surfaceContainerLowest", "surfaceDim",
  "primaryFixed", "primaryFixedDim", "onPrimaryFixed", "onPrimaryFixedVariant",
  "secondaryFixed", "secondaryFixedDim", "onSecondaryFixed", "onSecondaryFixedVariant",
  "tertiaryFixed", "tertiaryFixedDim", "onTertiaryFixed", "onTertiaryFixedVariant",
];

const hex = (argb) => "0xFF" + (argb & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
const block = (name, fn, isDark) => {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seedHex)), isDark, 0);
  const lines = roles.map((r) => `    ${r} = Color(${hex(MaterialDynamicColors[r].getArgb(scheme))}),`);
  return `internal val ${name} = ${fn}(\n${lines.join("\n")}\n)\n`;
};

process.stdout.write(`package app.kiumu.accura.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// Erzeugt mit scripts/rueckfall-farben.mjs (material-color-utilities 0.3.0, tonalSpot, Kontrast 0)
// aus dem Farbton #${seedHex.toUpperCase()}. Nicht von Hand ändern, neu erzeugen.

/** Rückfall-Schema Hell für Geräte ohne Dynamic Color. */
${block("RueckfallHell", "lightColorScheme", false)}
/** Rückfall-Schema Dunkel für Geräte ohne Dynamic Color. */
${block("RueckfallDunkel", "darkColorScheme", true)}`);
