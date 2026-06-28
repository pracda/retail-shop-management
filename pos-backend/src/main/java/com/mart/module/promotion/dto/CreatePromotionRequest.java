package com.mart.module.promotion.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public record CreatePromotionRequest(
        @NotNull Long storeId,
        String name,
        String description,
        String promoType,
        BigDecimal discountValue,
        BigDecimal minPurchase,
        BigDecimal maxDiscount,
        String appliesTo,
        Long targetId,
        Integer buyQuantity,
        Integer getQuantity,
        Instant startsAt,
        Instant endsAt
) {}
