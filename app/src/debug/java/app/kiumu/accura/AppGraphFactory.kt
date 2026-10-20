package app.kiumu.accura

import android.content.Context
import app.kiumu.accura.auth.FakeAuthGateway
import app.kiumu.accura.data.fake.FakeFinanceRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

private class FakeDebugTools : DebugTools {
    private val state = MutableStateFlow(DebugScenario.STANDARD)
    override val scenario: StateFlow<DebugScenario> = state
    override fun select(scenario: DebugScenario) {
        state.value = scenario
    }
}

fun createAppGraph(context: Context): AppGraph {
    val tools = FakeDebugTools()
    val assets = context.applicationContext.assets
    val repository = FakeFinanceRepository(
        scenario = tools.scenario,
        readJson = { name -> assets.open("$name.json").bufferedReader().use { it.readText() } },
    )
    return AppGraph(
        auth = FakeAuthGateway(latencyMillis = 400),
        finance = repository,
        debugTools = tools,
    )
}
