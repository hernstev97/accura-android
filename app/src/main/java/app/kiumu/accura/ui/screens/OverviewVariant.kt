package app.kiumu.accura.ui.screens

import androidx.annotation.StringRes
import app.kiumu.accura.R

/**
 * Varianten der Übersicht aus dem visuellen Prototyp (Phase 1.3, ACC-96). Steven vergleicht sie im
 * Debug-Menü und wählt eine; die anderen fallen danach weg. Ohne Debug-Menü (Release) gilt [Standard].
 * Beschreibung je Variante: docs/app/prototyp.md.
 */
enum class OverviewVariant(@StringRes val label: Int, @StringRes val description: Int) {
    KONTOSTAND(R.string.variant_kontostand, R.string.variant_kontostand_text),
    SPIELRAUM(R.string.variant_spielraum, R.string.variant_spielraum_text),
    ZEITLEISTE(R.string.variant_zeitleiste, R.string.variant_zeitleiste_text),
    ;

    companion object {
        val Standard = KONTOSTAND
    }
}
