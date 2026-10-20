package app.kiumu.accura.data

import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.BudgetStatus
import app.kiumu.accura.data.model.DebtState
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.IncomePartKey
import app.kiumu.accura.data.model.MetricKind
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.data.model.MetricUnit
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.PaymentSource
import app.kiumu.accura.data.model.SalaryStatus
import app.kiumu.accura.data.model.StepOp
import app.kiumu.accura.data.model.UpcomingModel
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * Vertragstest: Die App kann jede Antwort der Convex-Abfragen lesen. Die Beispiele unter
 * `src/test/resources/vertrag` sind Ausgaben des echten Rechenkerns (`convex/lib/views.ts` mit
 * `toWire`) für ausgedachte Testdaten, siehe docs/app/datenschicht.md.
 *
 * Gelesen wird streng: Kennt ein Modell der App ein Feld nicht, schlägt der Test fehl. So fällt
 * auf, wenn das Backend ein Feld ergänzt, das die App noch nicht abbildet.
 */
class VertragsTest {
    private val strict = Json { ignoreUnknownKeys = false }

    private fun <T> parse(serializer: DeserializationStrategy<T>, view: String, scenario: String): T =
        strict.decodeFromString(serializer, Vertrag.read("$view-$scenario"))

    private fun overview(scenario: String) = parse(OverviewModel.serializer(), "overview", scenario)
    private fun budget(scenario: String) = parse(BudgetModel.serializer(), "budget", scenario)
    private fun debts(scenario: String) = parse(DebtsModel.serializer(), "debts", scenario)
    private fun upcoming(scenario: String) = parse(UpcomingModel.serializer(), "upcoming", scenario)

    @Test
    fun `jedes Beispiel jeder Ansicht und jedes Szenarios lässt sich streng lesen`() {
        for (scenario in Vertrag.scenarios) {
            overview(scenario)
            budget(scenario)
            debts(scenario)
            upcoming(scenario)
        }
    }

    @Test
    fun `Demnächst standard stimmt mit den Zahlen der Convex-Tests überein`() {
        val model = upcoming("standard")
        assertEquals(LocalDate.of(2026, 8, 8), model.today)
        assertEquals(LocalDate.of(2026, 8, 25), model.nextSalaryDay)
        assertEquals(17, model.daysUntilSalary)
        assertEquals(listOf("Finanzierung A", "Versicherungen", "Ratenkredit"), model.payments.map { it.name })
        assertEquals(listOf(PaymentSource.DEBT, PaymentSource.BUDGET, PaymentSource.DEBT), model.payments.map { it.source })
        assertEquals(listOf(false, false, true), model.payments.map { it.isShortlyBeforeSalary })
        assertEquals(44_645L, model.pendingPayments.value)
        assertEquals(135_075L, model.accountsTotal.value)
        assertEquals(90_430L, model.availableUntilSalary.value)
        assertEquals(5_319L, model.dailyAllowance.value)
        assertEquals(MetricStatus.OK, model.availableUntilSalary.status)
        assertEquals(MetricKind.CALCULATED, model.availableUntilSalary.kind)
    }

    @Test
    fun `Rechenweg bleibt erhalten`() {
        val steps = upcoming("standard").availableUntilSalary.steps
        assertTrue(steps.size >= 3)
        assertEquals("Auf den Konten", steps.first().label)
        assertEquals(135_075L, steps.first().cents)
        assertEquals(90_430L, steps.last().cents)
    }

    @Test
    fun `Übersicht standard`() {
        val model = overview("standard")
        assertFalse(model.isEmpty)
        assertEquals(SalaryStatus.SET, model.salaryStatus)
        assertEquals(135_075L, model.accountsTotal.value)
        assertEquals(MetricUnit.MONTHS_X100, model.bufferMonths.unit)
        assertEquals(56L, model.bufferMonths.value)
        assertEquals(MetricUnit.DAY, model.debtFreeDay.unit)
        assertEquals(LocalDate.of(2029, 12, 20), model.debtFreeDay.day)
        assertNull(model.debtFreeDay.value)
        assertEquals(listOf(IncomePartKey.EXPENSES, IncomePartKey.RATES, IncomePartKey.RESERVES, IncomePartKey.FREE), model.incomeSplit?.parts?.map { it.key })
        assertEquals(300_000L, model.incomeSplit?.incomeCents)
        // Der Ring summiert exakt auf 100 %, der Rundungsrest geht an den größten Anteil (7.167 → 7.166).
        assertEquals(listOf(7_166, 1_355, 1_000, 479), model.incomeSplit?.parts?.map { it.shareBps })
        assertEquals(10_000, model.incomeSplit?.parts?.sumOf { it.shareBps ?: 0 })
        // Zum Anzeigen ganze Prozent, die auf genau 100 aufgehen (größter Rest): 72 + 13 + 10 + 5,
        // einzeln gerundet wären es 72 + 14 + 10 + 5 = 101.
        assertEquals(listOf(72, 13, 10, 5), model.incomeSplit?.parts?.map { it.sharePercent })
        assertEquals(100, model.incomeSplit?.parts?.sumOf { it.sharePercent ?: 0 })
        assertEquals(YearMonth.of(2026, 10), model.nextRelief?.freeFromMonth)
        assertEquals(12_000L, model.nextRelief?.monthlyReliefCents)
        assertEquals(0, model.dataAge.staleCount)
    }

    @Test
    fun `Übersicht veraltet meldet alte Stände`() {
        val model = overview("veraltet")
        assertTrue(model.dataAge.staleCount > 0)
        assertTrue(model.accounts.mapNotNull { it.stand }.all { it.stale })
        assertEquals(MetricStatus.STALE, model.accountsTotal.status)
    }

    @Test
    fun `Übersicht leer ist leer und erfindet nichts`() {
        val model = overview("leer")
        assertTrue(model.isEmpty)
        assertEquals(SalaryStatus.MISSING, model.salaryStatus)
        assertEquals(MetricStatus.UNAVAILABLE, model.accountsTotal.status)
        assertNull(model.accountsTotal.value)
        assertNotNull(model.accountsTotal.reason)
        assertNull(model.incomeSplit)
    }

    @Test
    fun `Negative Stände bleiben negativ`() {
        val model = overview("negativ")
        assertEquals(-39_834L, model.accounts.first().stand?.cents)
        assertTrue((model.accountsTotal.value ?: 0) < 135_075L)
        val budget = budget("negativ")
        assertEquals(BudgetStatus.OVERDRAWN, budget.status)
        assertTrue((budget.freeMonthly.value ?: 0) < 0)
        assertEquals(-(budget.freeMonthly.value ?: 0), budget.deficitCents)
    }

    @Test
    fun `Budget standard`() {
        val model = budget("standard")
        assertEquals(BudgetStatus.WITHIN_BUDGET, model.status)
        assertEquals(300_000L, model.incomeCents)
        assertEquals(model.expensesCents + model.reservesCents + model.ratesCents, model.plannedCents)
        assertEquals(14_355L, model.freeMonthly.value)
        assertEquals(5, model.necessityGroups.size)
        assertEquals(model.categories.sumOf { it.totalCents }, model.necessityGroups.sumOf { it.totalCents })
    }

    @Test
    fun `Budget leer`() {
        assertEquals(BudgetStatus.EMPTY, budget("leer").status)
    }

    @Test
    fun `Schulden standard`() {
        val model = debts("standard")
        assertEquals(3, model.debts.size)
        val loan = model.debts.first { it.id == "primary-loan" }
        assertEquals(DebtState.OK, loan.state)
        assertEquals(1_200_000L, loan.terms.principalCents)
        assertEquals(500, loan.terms.nominalRateBps)
        assertEquals(LocalDate.of(2025, 1, 20), loan.terms.firstPaymentDay)
        assertEquals(630L, loan.deviation?.differenceCents)
        assertEquals(860_000L, loan.payoff?.maxCents)
        assertEquals(3, model.relief.size)
        assertEquals(YearMonth.of(2026, 10), model.relief.first().freeFromMonth)
        assertEquals(LocalDate.of(2026, 8, 8), model.trajectory.first().day)
    }

    @Test
    fun `Schulden leer hat keine Kredite`() {
        assertTrue(debts("leer").debts.isEmpty())
    }

    @Test
    fun `Schulden veraltet markiert den alten Bankstand`() {
        val loan = debts("veraltet").debts.first { it.id == "primary-loan" }
        assertEquals(true, loan.deviation?.stale)
        assertEquals(MetricStatus.STALE, loan.balance.status)
    }

    @Test
    fun `Demnächst leer hat keinen Gehaltstag und zeigt keine Zahl`() {
        val model = upcoming("leer")
        assertEquals(SalaryStatus.MISSING, model.salaryStatus)
        assertNull(model.nextSalaryDay)
        assertTrue(model.payments.isEmpty())
        assertEquals(MetricStatus.UNAVAILABLE, model.availableUntilSalary.status)
        assertNull(model.availableUntilSalary.value)
    }

    @Test
    fun `Ohne Gehaltstag gibt es keine Zahl bis Gehalt, der Kontostand bleibt`() {
        val overview = overview("ohne-gehaltstag")
        val upcoming = upcoming("ohne-gehaltstag")
        assertEquals(SalaryStatus.MISSING, overview.salaryStatus)
        assertEquals(SalaryStatus.MISSING, upcoming.salaryStatus)
        assertFalse(overview.isEmpty)
        assertEquals(135_075L, overview.accountsTotal.value)
        assertEquals(135_075L, upcoming.accountsTotal.value)
        assertNull(upcoming.nextSalaryDay)
        assertNull(upcoming.daysUntilSalary)
        for (metric in listOf(overview.availableUntilSalary, overview.dailyAllowance, upcoming.availableUntilSalary, upcoming.dailyAllowance, upcoming.pendingPayments)) {
            assertEquals(metric.key, MetricStatus.UNAVAILABLE, metric.status)
            assertNull(metric.key, metric.value)
            assertEquals(metric.key, "Der Gehaltstag fehlt.", metric.reason)
            assertEquals(metric.key, listOf(StepOp.NOTE), metric.steps.map { it.op })
        }
        // Was nicht vom Gehaltstag abhängt, rechnet das Backend weiter.
        assertEquals(14_355L, overview.freeMonthly.value)
    }

    @Test
    fun `fehlender oder unbekannter Gehaltstag-Status lässt sich nicht lesen`() {
        val without = Vertrag.read("upcoming-standard").replaceFirst("\"salaryStatus\": \"set\",", "")
        val unknown = Vertrag.read("overview-standard").replaceFirst("\"salaryStatus\": \"set\"", "\"salaryStatus\": \"vielleicht\"")
        try {
            FinanceJson.lenient.decodeFromString(UpcomingModel.serializer(), without)
            fail("Ohne salaryStatus darf die App nicht still „gesetzt“ annehmen")
        } catch (_: SerializationException) {
            // gewollt
        }
        try {
            FinanceJson.lenient.decodeFromString(OverviewModel.serializer(), unknown)
            fail("Ein unbekannter salaryStatus darf nicht still gelesen werden")
        } catch (_: SerializationException) {
            // gewollt
        }
    }

    @Test
    fun `unbekannte Felder brechen die strenge Prüfung, nicht den Betrieb`() {
        val withExtra = Vertrag.read("upcoming-standard").replaceFirst("{", "{\"neuesFeld\": 1,")
        try {
            strict.decodeFromString(UpcomingModel.serializer(), withExtra)
            fail("Streng gelesen hätte das unbekannte Feld auffallen müssen")
        } catch (_: SerializationException) {
            // gewollt: der Vertragstest meldet das neue Feld
        }
        val lenient = FinanceJson.lenient.decodeFromString(UpcomingModel.serializer(), withExtra)
        assertEquals(44_645L, lenient.pendingPayments.value)
    }

    @Test
    fun `unbekannter Status lässt sich nicht lesen`() {
        val broken = Vertrag.read("upcoming-standard").replaceFirst("\"status\": \"ok\"", "\"status\": \"fantasie\"")
        try {
            FinanceJson.lenient.decodeFromString(UpcomingModel.serializer(), broken)
            fail("Ein unbekannter Status darf nicht still als belastbar gelten")
        } catch (_: SerializationException) {
            // gewollt
        }
    }
}
