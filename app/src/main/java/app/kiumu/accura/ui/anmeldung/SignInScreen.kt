package app.kiumu.accura.ui.anmeldung

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.auth.AuthError

/**
 * Eigene Anmeldeseite im accura-Design (kein fertiges Clerk-UI). Zustandslos: Zustand und Aktionen
 * kommen vom [SignInViewModel]. [hint] ist ein Hinweis nur für den Debug-Build mit Fake-Anmeldung.
 */
@Composable
fun SignInScreen(
    state: SignInUiState,
    onEmailChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    hint: String? = null,
) {
    Column(
        modifier = modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, alignment = androidx.compose.ui.Alignment.CenterVertically),
    ) {
        Text(stringResource(R.string.app_name), style = MaterialTheme.typography.displaySmall)
        Text(
            text = stringResource(if (state.step == SignInStep.EMAIL) R.string.signin_email_title else R.string.signin_code_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = if (state.step == SignInStep.EMAIL) {
                stringResource(R.string.signin_email_text)
            } else {
                stringResource(R.string.signin_code_text, state.email.trim())
            },
            style = MaterialTheme.typography.bodyLarge,
        )

        val errorText = state.error?.let { stringResource(it.textRes()) }
        when (state.step) {
            SignInStep.EMAIL -> OutlinedTextField(
                value = state.email,
                onValueChange = onEmailChange,
                label = { Text(stringResource(R.string.signin_email_label)) },
                singleLine = true,
                isError = errorText != null,
                supportingText = errorText?.let { { Text(it) } },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .semantics {
                        contentType = ContentType.EmailAddress
                        errorText?.let { error(it) }
                    },
            )
            SignInStep.CODE -> OutlinedTextField(
                value = state.code,
                onValueChange = onCodeChange,
                label = { Text(stringResource(R.string.signin_code_label)) },
                singleLine = true,
                isError = errorText != null,
                supportingText = errorText?.let { { Text(it) } },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .semantics {
                        contentType = ContentType.SmsOtpCode
                        errorText?.let { error(it) }
                    },
            )
        }

        val canSubmit = !state.busy && when (state.step) {
            SignInStep.EMAIL -> state.email.isNotBlank()
            SignInStep.CODE -> state.code.length == SignInViewModel.CODE_LENGTH
        }
        Button(
            onClick = onSubmit,
            enabled = canSubmit,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) {
            Text(
                stringResource(
                    when {
                        state.busy -> R.string.signin_busy
                        state.step == SignInStep.EMAIL -> R.string.signin_send_code
                        else -> R.string.signin_confirm
                    },
                ),
            )
        }
        if (state.step == SignInStep.CODE) {
            TextButton(onClick = onBack, enabled = !state.busy, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(stringResource(R.string.signin_other_email))
            }
        }
        hint?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

private fun AuthError.textRes(): Int = when (this) {
    AuthError.INVALID_EMAIL -> R.string.signin_error_invalid_email
    AuthError.CODE_INVALID -> R.string.signin_error_code_invalid
    AuthError.CODE_EXPIRED -> R.string.signin_error_code_expired
    AuthError.OFFLINE -> R.string.signin_error_offline
    AuthError.NOT_CONFIGURED -> R.string.signin_error_not_configured
    AuthError.UNKNOWN -> R.string.signin_error_unknown
}
