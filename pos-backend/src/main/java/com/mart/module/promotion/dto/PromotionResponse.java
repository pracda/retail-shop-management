package com.mart.module.promotion.dto;

import com.mart.module.promotion.entity.Promotion;

import java.math.BigDecimal;
import java.time.Instant;

public record PromotionResponse(
        Long id,
        Long storeId,
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
        Instant endsAt,
        Boolean isActive,
        Instant createdAt
) {
    public static PromotionResponse from(Promotion p) {
        return new PromotionResponse(
                p.getId(),
                p.getStore().getId(),
                p.getName(),
                p.getDescription(),
                p.getPromoType(),
                p.getDiscountValue(),
                p.getMinPurchase(),
                p.getMaxDiscount(),
                p.getAppliesTo(),
                p.getTargetId(),
                p.getBuyQuantity(),
                p.getGetQuantity(),
                p.getStartsAt(),
                p.getEndsAt(),
                p.getIsActive(),
                p.getCreatedAt()
        );
    }
}
