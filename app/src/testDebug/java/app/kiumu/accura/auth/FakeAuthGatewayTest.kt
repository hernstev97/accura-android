package app.kiumu.accura.auth

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class FakeAuthGatewayTest {
    private val auth = FakeAuthGateway()

    @Test
    fun `Start ist abgemeldet`() {
        assertEquals(Session.SignedOut, auth.session.value)
    }

    @Test
    fun `Ablauf E-Mail, Code, angemeldet, abmelden`() = runTest {
        assertEquals(AuthResult.Success, auth.requestCode(" test@example.test "))
        assertEquals(Session.SignedOut, auth.session.value)
        assertEquals(AuthResult.Success, auth.verifyCode(FakeAuthGateway.VALID_CODE))
        assertEquals(Session.SignedIn, auth.session.value)
        auth.signOut()
        assertEquals(Session.SignedOut, auth.session.value)
    }

    @Test
    fun `Ungültige Adresse`() = runTest {
        assertEquals(AuthResult.Failure(AuthError.INVALID_EMAIL), auth.requestCode("kein-at-zeichen"))
        assertEquals(AuthResult.Failure(AuthError.INVALID_EMAIL), auth.requestCode(""))
    }

    @Test
    fun `Falscher und abgelaufener Code melden sich nicht an`() = runTest {
        auth.requestCode("test@example.test")
        assertEquals(AuthResult.Failure(AuthError.CODE_INVALID), auth.verifyCode("111111"))
        assertEquals(AuthResult.Failure(AuthError.CODE_EXPIRED), auth.verifyCode(FakeAuthGateway.EXPIRED_CODE))
        assertEquals(Session.SignedOut, auth.session.value)
    }

    @Test
    fun `Ohne angeforderten Code gibt es keine Anmeldung`() = runTest {
        assertEquals(AuthResult.Failure(AuthError.UNKNOWN), auth.verifyCode(FakeAuthGateway.VALID_CODE))
        assertEquals(Session.SignedOut, auth.session.value)
    }

    @Test
    fun `Keine Verbindung`() = runTest {
        assertEquals(AuthResult.Failure(AuthError.OFFLINE), auth.requestCode(FakeAuthGateway.OFFLINE_EMAIL))
    }

    @Test
    fun `Der Code gilt nur einmal`() = runTest {
        auth.requestCode("test@example.test")
        auth.verifyCode(FakeAuthGateway.VALID_CODE)
        auth.signOut()
        assertEquals(AuthResult.Failure(AuthError.UNKNOWN), auth.verifyCode(FakeAuthGateway.VALID_CODE))
    }
}
