package com.mart.module.report.dto;

import java.math.BigDecimal;

public record CategorySalesRow(
        Long categoryId,
        String categoryName,
        BigDecimal qtySold,
        BigDecimal revenue,
        BigDecimal cogs,
        BigDecimal grossProfit
) {}
