package com.mart.module.ecommerce.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.security.CustomerPrincipal;
import com.mart.module.ecommerce.dto.request.CartItemRequest;
import com.mart.module.ecommerce.dto.response.CartResponse;
import com.mart.module.ecommerce.service.EcommerceCartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/ecommerce/cart")
@RequiredArgsConstructor
public class EcommerceCartController {

    private final EcommerceCartService cartService;

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<CartResponse>> getCart(
            @AuthenticationPrincipal CustomerPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.success(
                cartService.getCart(principal.getId(), principal.getStoreId())));
    }

    @PutMapping("/items")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<CartResponse>> upsertItem(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @Valid @RequestBody CartItemRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                cartService.upsertItem(principal.getId(), principal.getStoreId(), request)));
    }

    @DeleteMapping("/items/{productId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<CartResponse>> removeItem(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.success(
                cartService.removeItem(principal.getId(), principal.getStoreId(), productId)));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<Void>> clearCart(
            @AuthenticationPrincipal CustomerPrincipal principal) {
        cartService.clearCart(principal.getId(), principal.getStoreId());
        return ResponseEntity.ok(ApiResponse.success("Cart cleared", null));
    }
}
