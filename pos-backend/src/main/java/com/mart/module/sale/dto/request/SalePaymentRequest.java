package com.mart.module.sale.dto.request;

import com.mart.module.sale.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SalePaymentRequest(
        @NotNull PaymentMethod paymentMethod,
        @NotNull BigDecimal amount
) {}
