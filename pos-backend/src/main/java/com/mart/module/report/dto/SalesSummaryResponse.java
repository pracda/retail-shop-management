package com.mart.module.report.dto;

import java.math.BigDecimal;

public record SalesSummaryResponse(
        long transactionCount,
        long voidedCount,
        BigDecimal totalRevenue,
        BigDecimal totalDiscounts,
        BigDecimal avgTransactionValue
) {}
