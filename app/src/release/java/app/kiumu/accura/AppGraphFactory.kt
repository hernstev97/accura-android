package app.kiumu.accura

import android.content.Context
import app.kiumu.accura.auth.NotConfiguredAuthGateway
import app.kiumu.accura.data.NotConnectedFinanceRepository

fun createAppGraph(@Suppress("UNUSED_PARAMETER") context: Context): AppGraph =
    AppGraph(auth = NotConfiguredAuthGateway, finance = NotConnectedFinanceRepository)
