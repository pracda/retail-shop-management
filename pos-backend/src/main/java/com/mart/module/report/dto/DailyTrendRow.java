package com.mart.module.report.dto;

import java.math.BigDecimal;

public record DailyTrendRow(
        String date,
        long transactionCount,
        BigDecimal revenue
) {}
