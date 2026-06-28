package com.mart.module.ecommerce.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.common.security.CustomerPrincipal;
import com.mart.module.ecommerce.dto.request.PlaceOrderRequest;
import com.mart.module.ecommerce.dto.response.OnlineOrderResponse;
import com.mart.module.ecommerce.service.EcommerceOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ecommerce/orders")
@RequiredArgsConstructor
public class EcommerceOrderController {

    private final EcommerceOrderService orderService;

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> placeOrder(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @Valid @RequestBody PlaceOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Order placed",
                        orderService.placeOrder(principal.getId(), principal.getStoreId(), request)));
    }

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<PageResponse<OnlineOrderResponse>>> getOrders(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var pageable = PageRequest.of(page, size, Sort.by("placedAt").descending());
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getOrders(principal.getId(), pageable)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> getOrder(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getOrder(principal.getId(), id)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> cancelOrder(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String reason = body.getOrDefault("reason", "Cancelled by customer");
        return ResponseEntity.ok(ApiResponse.success(
                orderService.cancelOrder(principal.getId(), id, reason)));
    }
}
