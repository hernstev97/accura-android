@file:UseSerializers(CalendarDaySerializer::class, CalendarMonthSerializer::class)

package app.kiumu.accura.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers

/** Ob ein (gültiger) Gehaltstag gesetzt ist. Bei [MISSING] gibt es keinen Zeitraum „bis Gehalt“ und keine Zahl dafür. */
@Serializable
enum class SalaryStatus {
    @SerialName("set") SET,
    @SerialName("missing") MISSING,
}

@Serializable
enum class PaymentSource {
    @SerialName("budget") BUDGET,
    @SerialName("debt") DEBT,
}

@Serializable
data class UpcomingPayment(
    val id: String,
    val name: String,
    val source: PaymentSource,
    val cents: Long,
    val dueDay: CalendarDay,
    /** Tag des Monats laut Vertrag oder Budgetposten. */
    val dayOfMonth: Int,
    val daysUntilDue: Int,
    /** 1 bis 7 Tage vor dem Gehalt. */
    val isShortlyBeforeSalary: Boolean,
)

/** Antwort von `views:upcoming`. */
@Serializable
data class UpcomingModel(
    val today: CalendarDay,
    /** Pflichtfeld ohne Standardwert: Fehlt es in der Antwort, ist das ein Lesefehler, kein stilles „gesetzt“. */
    val salaryStatus: SalaryStatus,
    val nextSalaryDay: CalendarDay? = null,
    val daysUntilSalary: Int? = null,
    val payments: List<UpcomingPayment>,
    val pendingPayments: Metric,
    val accountsTotal: Metric,
    val availableUntilSalary: Metric,
    val dailyAllowance: Metric,
)
