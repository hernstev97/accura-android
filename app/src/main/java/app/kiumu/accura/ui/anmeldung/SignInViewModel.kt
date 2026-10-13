package app.kiumu.accura.ui.anmeldung

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kiumu.accura.auth.AuthError
import app.kiumu.accura.auth.AuthGateway
import app.kiumu.accura.auth.AuthResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class SignInStep { EMAIL, CODE }

data class SignInUiState(
    val step: SignInStep = SignInStep.EMAIL,
    val email: String = "",
    val code: String = "",
    val busy: Boolean = false,
    val error: AuthError? = null,
)

/** Zwei Schritte: E-Mail eingeben, Code eingeben. Die Sitzung selbst hält der [AuthGateway]. */
class SignInViewModel(private val auth: AuthGateway) : ViewModel() {
    private val _state = MutableStateFlow(SignInUiState())
    val state: StateFlow<SignInUiState> = _state

    fun onEmailChange(value: String) = _state.update { it.copy(email = value, error = null) }

    fun onCodeChange(value: String) = _state.update { it.copy(code = value.filter(Char::isDigit).take(CODE_LENGTH), error = null) }

    fun submit() {
        val current = _state.value
        if (current.busy) return
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (current.step) {
                SignInStep.EMAIL -> finish(auth.requestCode(current.email)) { it.copy(step = SignInStep.CODE, code = "") }
                // Bei Erfolg wechselt die Sitzung auf „angemeldet“, die Oberfläche verlässt diesen Bildschirm.
                SignInStep.CODE -> finish(auth.verifyCode(current.code)) { it }
            }
        }
    }

    /** Zurück zur E-Mail, etwa weil die Adresse falsch war. */
    fun back() = _state.update { it.copy(step = SignInStep.EMAIL, code = "", error = null) }

    private fun finish(result: AuthResult, onSuccess: (SignInUiState) -> SignInUiState) {
        _state.update {
            when (result) {
                AuthResult.Success -> onSuccess(it).copy(busy = false)
                is AuthResult.Failure -> it.copy(busy = false, error = result.error)
            }
        }
    }

    companion object {
        const val CODE_LENGTH = 6
    }
}
