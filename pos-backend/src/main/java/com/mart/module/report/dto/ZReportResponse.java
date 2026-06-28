package com.mart.module.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record ZReportResponse(
        LocalDate date,
        Long storeId,
        String storeName,
        BigDecimal totalSales,
        long saleCount,
        BigDecimal totalRefunds,
        long refundCount,
        BigDecimal totalVoids,
        long voidCount,
        BigDecimal totalExpenses,
        BigDecimal taxCollected,
        Map<String, BigDecimal> paymentBreakdown,
        BigDecimal expectedCashInDrawer,
        List<ShiftSummary> shiftSummaries
) {
    public record ShiftSummary(
            Long shiftId,
            String cashierName,
            BigDecimal openingFloat,
            BigDecimal totalSales,
            long saleCount,
            BigDecimal expenses,
            BigDecimal closingCash
    ) {}
}
