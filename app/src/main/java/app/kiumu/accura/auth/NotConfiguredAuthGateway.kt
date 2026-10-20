package app.kiumu.accura.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Anmeldung des Release-Builds, bis Clerk angeschlossen ist: Es meldet sich niemand an. */
object NotConfiguredAuthGateway : AuthGateway {
    override val session: StateFlow<Session> = MutableStateFlow(Session.SignedOut)
    override suspend fun requestCode(email: String): AuthResult = AuthResult.Failure(AuthError.NOT_CONFIGURED)
    override suspend fun verifyCode(code: String): AuthResult = AuthResult.Failure(AuthError.NOT_CONFIGURED)
    override suspend fun signOut() = Unit
}
