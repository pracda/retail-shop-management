package com.mart.module.report.dto;

import java.math.BigDecimal;

public record ProfitLossResponse(
        BigDecimal revenue,
        BigDecimal cogs,
        BigDecimal grossProfit,
        BigDecimal grossMarginPct,
        BigDecimal totalDiscounts
) {}
