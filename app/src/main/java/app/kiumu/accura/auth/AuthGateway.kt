package app.kiumu.accura.auth

import kotlinx.coroutines.flow.StateFlow

sealed interface Session {
    /** Gespeicherte Sitzung wird noch geprüft. */
    data object Loading : Session
    data object SignedOut : Session
    data object SignedIn : Session
}

enum class AuthError {
    INVALID_EMAIL,
    CODE_INVALID,
    CODE_EXPIRED,
    OFFLINE,
    NOT_CONFIGURED,
    UNKNOWN,
}

sealed interface AuthResult {
    data object Success : AuthResult
    data class Failure(val error: AuthError) : AuthResult
}

/**
 * Anmeldung per E-Mail-Code. Hinter dieser Schnittstelle sitzt später das Clerk-SDK
 * (`clerk-android-api`); die Oberfläche kennt weder Token noch Clerk-Typen. Der Ablauf hat zwei
 * Schritte: erst [requestCode], dann [verifyCode] für dieselbe Adresse.
 */
interface AuthGateway {
    val session: StateFlow<Session>

    /** Schickt einen Code an die Adresse. */
    suspend fun requestCode(email: String): AuthResult

    /** Prüft den Code des letzten [requestCode]. Bei Erfolg wechselt [session] auf [Session.SignedIn]. */
    suspend fun verifyCode(code: String): AuthResult

    suspend fun signOut()
}
