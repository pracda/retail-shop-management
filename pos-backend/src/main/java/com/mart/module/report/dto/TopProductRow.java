package com.mart.module.report.dto;

import java.math.BigDecimal;

public record TopProductRow(
        Long productId,
        String productName,
        String barcode,
        BigDecimal qtySold,
        BigDecimal revenue,
        BigDecimal cogs,
        BigDecimal grossProfit
) {}
