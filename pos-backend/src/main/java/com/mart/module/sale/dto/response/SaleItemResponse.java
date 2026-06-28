package com.mart.module.sale.dto.response;

import com.mart.module.sale.entity.SaleItem;

import java.math.BigDecimal;

public record SaleItemResponse(
        Long id,
        Long productId,
        String productName,
        String variantName,
        String barcode,
        String manualDescription,
        boolean isManual,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal discountAmount,
        BigDecimal lineTotal
) {
    public static SaleItemResponse from(SaleItem item) {
        boolean manual = item.getProduct() == null;
        return new SaleItemResponse(
                item.getId(),
                manual ? null                        : item.getProduct().getId(),
                manual ? item.getManualDescription() : item.getProduct().getName(),
                manual ? null                        : item.getProduct().getVariantName(),
                manual ? null                        : item.getProduct().getBarcode(),
                item.getManualDescription(),
                manual,
                item.getQuantity(),
                item.getUnitPrice(),
                item.getDiscountAmount(),
                item.getLineTotal()
        );
    }
}
