package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class CartResponse {
    private Long cartId;
    private List<CartItemResponse> items;
    private BigDecimal subtotal;
    private int itemCount;

    @Data @Builder
    public static class CartItemResponse {
        private Long productId;
        private String productName;
        private BigDecimal unitPrice;
        private Integer quantity;
        private BigDecimal lineTotal;
        private BigDecimal currentStock;
        private Boolean inStock;
    }
}
