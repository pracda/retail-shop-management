package com.mart.module.report.dto;

import java.math.BigDecimal;

public record CashierReportRow(
        Long cashierId,
        String cashierName,
        long transactionCount,
        BigDecimal revenue,
        BigDecimal avgTransactionValue
) {}
