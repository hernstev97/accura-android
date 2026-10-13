@file:UseSerializers(CalendarDaySerializer::class, CalendarMonthSerializer::class)

package app.kiumu.accura.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers

@Serializable
enum class DebtKind {
    @SerialName("loan") LOAN,
    @SerialName("installment") INSTALLMENT,
}

/** ok = Plan vorhanden; invalid = Vertragsdaten unvollständig, keine Rechnung. */
@Serializable
enum class DebtState {
    @SerialName("ok") OK,
    @SerialName("invalid") INVALID,
}

@Serializable
enum class PayoffSource {
    @SerialName("bank") BANK,
    @SerialName("estimated") ESTIMATED,
}

@Serializable
enum class ScheduleWarning {
    @SerialName("payment_below_interest") PAYMENT_BELOW_INTEREST,
    @SerialName("unexpected_residual") UNEXPECTED_RESIDUAL,
    @SerialName("final_payment_far_from_rate") FINAL_PAYMENT_FAR_FROM_RATE,
}

@Serializable
data class DebtTerms(
    val principalCents: Long,
    val nominalRateBps: Int,
    val effectiveRateBps: Int,
    val monthlyPaymentCents: Long,
    val firstPaymentDay: CalendarDay,
    val paymentCount: Int,
    val finalPaymentCents: Long? = null,
    val specialRepaymentYearlyCents: Long? = null,
)

@Serializable
data class NextPayment(val day: CalendarDay, val cents: Long)

@Serializable
data class Payoff(
    val balanceCents: Long,
    val feeCapCents: Long,
    /** Ablösesumme als Obergrenze. */
    val maxCents: Long,
    val feeBps: Int,
    val source: PayoffSource,
    val cappedByRemainingInterest: Boolean,
)

/** Abweichung des Plans vom zuletzt eingetragenen Bankstand. */
@Serializable
data class Deviation(
    val day: CalendarDay,
    val bankCents: Long,
    val planCents: Long,
    val differenceCents: Long,
    val ageDays: Int,
    val stale: Boolean,
)

@Serializable
data class SpecialRepaymentExample(
    val yearlyCents: Long,
    val endDay: CalendarDay? = null,
    val remainingInterestCents: Long,
    val interestSavedCents: Long,
    val paymentsSaved: Int,
)

@Serializable
data class DebtView(
    val id: String,
    val lender: String,
    val kind: DebtKind,
    val note: String? = null,
    val state: DebtState,
    val issues: List<String>,
    val balance: Metric,
    val terms: DebtTerms,
    val nextPayment: NextPayment? = null,
    val lastPaymentDay: CalendarDay? = null,
    val remainingPaymentCount: Int,
    val remainingTotalCents: Long,
    val interestToEndCents: Long,
    val payoff: Payoff? = null,
    val deviation: Deviation? = null,
    val specialRepaymentExample: SpecialRepaymentExample? = null,
    val warnings: List<ScheduleWarning>,
)

@Serializable
data class ReliefGroup(
    val freeFromMonth: CalendarMonth,
    val monthlyReliefCents: Long,
    val events: List<ReliefEvent>,
    val freeAfterCents: Long? = null,
)

/** Gesamtrestschuld heute (`day` gesetzt) und am Ende jedes Monats mit mindestens einer Rate. */
@Serializable
data class TrajectoryPoint(val day: CalendarDay? = null, val month: CalendarMonth, val balanceCents: Long)

/** Antwort von `views:debts`. */
@Serializable
data class DebtsModel(
    val today: CalendarDay,
    val debts: List<DebtView>,
    val remaining: Metric,
    val payoffMax: Metric,
    val interestToEnd: Metric,
    val extraCostVsPayoff: Metric,
    val debtFreeDay: Metric,
    val monthlyRatesCents: Long,
    val relief: List<ReliefGroup>,
    val trajectory: List<TrajectoryPoint>,
)
