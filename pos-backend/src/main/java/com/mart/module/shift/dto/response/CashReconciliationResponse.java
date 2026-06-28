package com.mart.module.shift.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

public record CashReconciliationResponse(
        Long shiftId,
        String cashierName,
        Instant openedAt,
        Instant closedAt,
        String status,

        /** Opening float the cashier started with. */
        BigDecimal openingFloat,

        /** Sum of all CASH payment method receipts in this shift. */
        BigDecimal cashSalesTotal,

        /** Sum of approved CASH refunds on sales from this shift. */
        BigDecimal cashRefundsTotal,

        /** Total expenses paid out in cash during this shift. */
        BigDecimal expenseTotal,

        /**
         * Expected cash in drawer:
         * openingFloat + cashSalesTotal - cashRefundsTotal - expenseTotal
         */
        BigDecimal expectedCash,

        /** What the cashier actually counted at close (null if shift is still open). */
        BigDecimal closingCash,

        /** closingCash - expectedCash (null if shift is open). Positive = overage, negative = shortage. */
        BigDecimal variance
) {}
