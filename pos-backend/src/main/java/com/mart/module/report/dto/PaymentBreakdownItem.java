package com.mart.module.report.dto;

import java.math.BigDecimal;

public record PaymentBreakdownItem(
        String paymentMethod,
        long transactionCount,
        BigDecimal totalAmount,
        BigDecimal pctOfTotal
) {}
