package app.kiumu.accura.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ShortNavigationBar
import androidx.compose.material3.ShortNavigationBarItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Density
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.kiumu.accura.AppGraph
import app.kiumu.accura.R
import app.kiumu.accura.auth.Session
import app.kiumu.accura.data.ViewState
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import app.kiumu.accura.ui.anmeldung.SignInScreen
import app.kiumu.accura.ui.anmeldung.SignInStep
import app.kiumu.accura.ui.anmeldung.SignInViewModel
import app.kiumu.accura.ui.katalog.Laden
import app.kiumu.accura.ui.katalog.SwapIcon
import app.kiumu.accura.nextWithData
import app.kiumu.accura.ui.navigation.Destination
import app.kiumu.accura.ui.navigation.DebugRoute
import app.kiumu.accura.ui.screens.BudgetScreen
import app.kiumu.accura.ui.screens.DebtsScreen
import app.kiumu.accura.ui.screens.DebugScreen
import app.kiumu.accura.ui.screens.OverviewScreen
import app.kiumu.accura.ui.screens.OverviewVariant
import app.kiumu.accura.ui.screens.UpcomingScreen
import app.kiumu.accura.ui.screens.ViewStateViewModel
import app.kiumu.accura.ui.theme.AccuraTheme

/**
 * Wurzel der App. Die Anmeldung ist ein Zustand, keine Route: Wer nicht angemeldet ist, erreicht
 * keine Ansicht, auch nicht über Zurück oder einen Deep Link. Beim Abmelden verschwindet der ganze
 * angemeldete Teil samt seiner ViewModels, es bleiben keine Finanzdaten im Speicher hängen.
 */
@Composable
fun AccuraApp(
    graph: AppGraph,
    modifier: Modifier = Modifier,
    dynamicColor: Boolean = true,
    darkTheme: Boolean = isSystemInDarkTheme(),
) {
    AccuraTheme(darkTheme = darkTheme, dynamicColor = dynamicColor) {
        Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            val session by graph.auth.session.collectAsStateWithLifecycle()
            when (session) {
                Session.Loading -> Laden()
                Session.SignedOut -> SessionScope { SignInRoute(graph) }
                Session.SignedIn -> SessionScope { MainScaffold(graph) }
            }
        }
    }
}

private const val NavBarMaxFontScale = 1.3f

@Composable
private fun SignInRoute(graph: AppGraph) {
    // Der ViewModel-Speicher dieser Route ist der eigene aus SessionScope und geht beim Drehen verloren.
    // Schritt und E-Mail liegen deshalb zusätzlich im gespeicherten Compose-Zustand der Activity.
    var savedStep by rememberSaveable { mutableStateOf(SignInStep.EMAIL.name) }
    var savedEmail by rememberSaveable { mutableStateOf("") }
    val viewModel = viewModel<SignInViewModel>(
        factory = viewModelFactory {
            initializer {
                SignInViewModel(
                    graph.auth,
                    initialStep = runCatching { SignInStep.valueOf(savedStep) }.getOrDefault(SignInStep.EMAIL),
                    initialEmail = savedEmail,
                )
            }
        },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.step, state.email) {
        savedStep = state.step.name
        savedEmail = state.email
    }
    SignInScreen(
        state = state,
        onEmailChange = viewModel::onEmailChange,
        onCodeChange = viewModel::onCodeChange,
        onSubmit = viewModel::submit,
        onBack = viewModel::back,
        hint = if (graph.debugTools != null) stringResource(R.string.signin_debug_hint) else null,
    )
}

/**
 * Eigener ViewModel-Speicher je Sitzungszustand, geleert beim Wechsel: Nach dem Abmelden zeigt die
 * Anmeldung wieder den ersten Schritt (keine alte Adresse, kein halber Code), nach dem Anmelden
 * bleiben keine Anmeldedaten übrig.
 */
@Composable
private fun SessionScope(content: @Composable () -> Unit) {
    val owner = remember {
        object : ViewModelStoreOwner {
            override val viewModelStore = ViewModelStore()
        }
    }
    DisposableEffect(owner) { onDispose { owner.viewModelStore.clear() } }
    CompositionLocalProvider(LocalViewModelStoreOwner provides owner, content = content)
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3ExpressiveApi::class)
@Composable
private fun MainScaffold(graph: AppGraph) {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val current = Destination.entries.firstOrNull { it.route == route }
    val onDebug = route == DebugRoute
    var menuOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when {
                            onDebug -> stringResource(R.string.debug_title)
                            current != null -> stringResource(current.label)
                            else -> stringResource(R.string.app_name)
                        },
                    )
                },
                navigationIcon = {
                    if (onDebug) {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                        }
                    }
                },
                actions = {
                    val tools = graph.debugTools
                    if (tools != null && current != null) {
                        // Nur Debug-Build: Testdaten wechseln, ohne die Ansicht zu verlassen. So sind
                        // Formwechsel und Zahlbewegung im Prototyp zu sehen.
                        IconButton(onClick = { tools.select(tools.scenario.value.nextWithData()) }) {
                            Icon(SwapIcon, contentDescription = stringResource(R.string.debug_cycle_scenario))
                        }
                    }
                    Box {
                        IconButton(onClick = { menuOpen = true }) {
                            Icon(Icons.Default.AccountCircle, contentDescription = stringResource(R.string.menu_account))
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            if (graph.debugTools != null) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.menu_debug)) },
                                    onClick = {
                                        menuOpen = false
                                        navController.navigate(DebugRoute) { launchSingleTop = true }
                                    },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.menu_sign_out)) },
                                onClick = {
                                    menuOpen = false
                                    scope.launch { graph.auth.signOut() }
                                },
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            if (current != null) {
                // Vier Beschriftungen in einer Zeile brechen bei 200 % mitten im Wort. Die Leiste skaliert
                // deshalb nur bis 130 %; alle Namen bleiben ganz lesbar, der Inhalt skaliert voll.
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, density.fontScale.coerceAtMost(NavBarMaxFontScale))) {
                  ShortNavigationBar {
                    Destination.entries.forEach { destination ->
                        ShortNavigationBarItem(
                            selected = destination == current,
                            onClick = {
                                navController.navigate(destination.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(destination.icon, contentDescription = null) },
                            label = { Text(stringResource(destination.label), maxLines = 1, softWrap = false) },
                        )
                    }
                  }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Destination.Overview.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Destination.Overview.route) {
                val variant = graph.debugTools?.overviewVariant?.collectAsStateWithLifecycle()?.value ?: OverviewVariant.Standard
                ViewRoute(graph, graph.finance::overview) { state, retry -> OverviewScreen(state, retry, variant = variant) }
            }
            composable(Destination.Upcoming.route) {
                ViewRoute(graph, graph.finance::upcoming) { state, retry -> UpcomingScreen(state, retry) }
            }
            composable(Destination.Budget.route) {
                ViewRoute(graph, graph.finance::budget) { state, retry -> BudgetScreen(state, retry) }
            }
            composable(Destination.Debts.route) {
                ViewRoute(graph, graph.finance::debts) { state, retry -> DebtsScreen(state, retry) }
            }
            composable(DebugRoute) { graph.debugTools?.let { DebugScreen(it) } }
        }
    }
}

/** Verdrahtet eine Ansicht mit ihrem ViewModel. Die Bildschirme selbst bleiben zustandslos. */
@Composable
private fun <T> ViewRoute(
    graph: AppGraph,
    source: (LocalDate) -> Flow<ViewState<T>>,
    screen: @Composable (ViewState<T>, () -> Unit) -> Unit,
) {
    val viewModel = viewModel<ViewStateViewModel<T>>(
        factory = viewModelFactory { initializer { ViewStateViewModel(graph.clock, source) } },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    screen(state, viewModel::retry)
}
