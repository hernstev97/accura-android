package app.kiumu.accura.ui.theme

import android.animation.ValueAnimator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

/**
 * `true`, wenn das System keine Animationen will: Bedienungshilfe „Animationen entfernen“ oder
 * Animator-Skalierung 0 in den Entwickleroptionen. Beides setzt `ANIMATOR_DURATION_SCALE` auf 0.
 *
 * Compose verkürzt eigene Animationen dann schon selbst auf null. Die Bausteine fragen den Wert
 * trotzdem ausdrücklich ab: Formwechsel und Zahlwechsel springen ohne Zwischenbild in den Endzustand,
 * und Tests können den Zustand setzen.
 */
val LocalReduceMotion = staticCompositionLocalOf { false }

/** Liest die Systemeinstellung und liest sie nach jeder Rückkehr in die App neu (die Einstellung kann sich dazwischen ändern). */
@Composable
fun systemReduceMotion(): Boolean {
    var reduce by remember { mutableStateOf(!ValueAnimator.areAnimatorsEnabled()) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { reduce = !ValueAnimator.areAnimatorsEnabled() }
    return reduce
}
