package app.kiumu.accura.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.todayFlow
import java.time.Clock
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update

/** Eine Ansicht: holt den Zustand für den heutigen Tag, fragt bei Tageswechsel und „Erneut versuchen“ neu. */
@OptIn(ExperimentalCoroutinesApi::class)
class ViewStateViewModel<T>(
    clock: Clock,
    source: (today: LocalDate) -> Flow<ViewState<T>>,
) : ViewModel() {
    private val retries = MutableStateFlow(0)

    val state: StateFlow<ViewState<T>> = combine(clock.todayFlow(), retries) { today, _ -> today }
        .flatMapLatest(source)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000, replayExpirationMillis = 0), ViewState.Loading)

    fun retry() = retries.update { it + 1 }
}
