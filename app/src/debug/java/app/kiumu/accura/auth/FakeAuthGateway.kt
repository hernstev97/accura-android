package app.kiumu.accura.auth

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Fake-Anmeldung für den Debug-Build und die Tests. Jede gültig aussehende Adresse bekommt einen Code,
 * der Code ist [VALID_CODE]. Zum Üben von Fehlern: [OFFLINE_EMAIL] meldet „keine Verbindung“,
 * [EXPIRED_CODE] „Code abgelaufen“, jeder andere Code „Code falsch“. Es gibt kein Konto und kein Token.
 */
class FakeAuthGateway(private val latencyMillis: Long = 0, signedIn: Boolean = false) : AuthGateway {
    private val state = MutableStateFlow<Session>(if (signedIn) Session.SignedIn else Session.SignedOut)
    override val session: StateFlow<Session> = state

    private var pendingEmail: String? = null

    override suspend fun requestCode(email: String): AuthResult {
        if (latencyMillis > 0) delay(latencyMillis)
        val trimmed = email.trim()
        if (!EMAIL.matches(trimmed)) return AuthResult.Failure(AuthError.INVALID_EMAIL)
        if (trimmed == OFFLINE_EMAIL) return AuthResult.Failure(AuthError.OFFLINE)
        pendingEmail = trimmed
        return AuthResult.Success
    }

    override suspend fun verifyCode(code: String): AuthResult {
        if (latencyMillis > 0) delay(latencyMillis)
        if (pendingEmail == null) return AuthResult.Failure(AuthError.UNKNOWN)
        return when (code.trim()) {
            VALID_CODE -> {
                pendingEmail = null
                state.value = Session.SignedIn
                AuthResult.Success
            }
            EXPIRED_CODE -> AuthResult.Failure(AuthError.CODE_EXPIRED)
            else -> AuthResult.Failure(AuthError.CODE_INVALID)
        }
    }

    override suspend fun signOut() {
        pendingEmail = null
        state.value = Session.SignedOut
    }

    companion object {
        const val VALID_CODE = "123456"
        const val EXPIRED_CODE = "000000"
        const val OFFLINE_EMAIL = "offline@example.test"
        private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    }
}
