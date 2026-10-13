package app.kiumu.accura.auth

import app.kiumu.accura.ui.anmeldung.SignInStep
import app.kiumu.accura.ui.anmeldung.SignInViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SignInViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val auth = FakeAuthGateway()
    private lateinit var viewModel: SignInViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        viewModel = SignInViewModel(auth)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `E-Mail, dann Code, dann angemeldet`() = runTest(dispatcher) {
        viewModel.onEmailChange("test@example.test")
        viewModel.submit()
        advanceUntilIdle()
        assertEquals(SignInStep.CODE, viewModel.state.value.step)
        assertFalse(viewModel.state.value.busy)

        viewModel.onCodeChange("123456")
        viewModel.submit()
        advanceUntilIdle()
        assertEquals(Session.SignedIn, auth.session.value)
    }

    @Test
    fun `Ungültige Adresse bleibt im ersten Schritt mit Fehler`() = runTest(dispatcher) {
        viewModel.onEmailChange("kaputt")
        viewModel.submit()
        advanceUntilIdle()
        assertEquals(SignInStep.EMAIL, viewModel.state.value.step)
        assertEquals(AuthError.INVALID_EMAIL, viewModel.state.value.error)
    }

    @Test
    fun `Falscher Code zeigt Fehler und der Fehler verschwindet beim Tippen`() = runTest(dispatcher) {
        viewModel.onEmailChange("test@example.test")
        viewModel.submit()
        advanceUntilIdle()
        viewModel.onCodeChange("111111")
        viewModel.submit()
        advanceUntilIdle()
        assertEquals(AuthError.CODE_INVALID, viewModel.state.value.error)
        assertEquals(Session.SignedOut, auth.session.value)
        viewModel.onCodeChange("11111")
        assertNull(viewModel.state.value.error)
    }

    @Test
    fun `Code nimmt nur Ziffern und höchstens sechs Stellen`() {
        viewModel.onCodeChange("12 34-56789")
        assertEquals("123456", viewModel.state.value.code)
    }

    @Test
    fun `Zurück führt zur E-Mail und leert den Code`() = runTest(dispatcher) {
        viewModel.onEmailChange("test@example.test")
        viewModel.submit()
        advanceUntilIdle()
        viewModel.onCodeChange("123")
        viewModel.back()
        assertEquals(SignInStep.EMAIL, viewModel.state.value.step)
        assertEquals("", viewModel.state.value.code)
    }
}
