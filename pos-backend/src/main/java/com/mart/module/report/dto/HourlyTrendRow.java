package com.mart.module.report.dto;

import java.math.BigDecimal;

public record HourlyTrendRow(
        int hour,           // 0–23
        long txnCount,
        BigDecimal revenue
) {}
