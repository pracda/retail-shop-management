package com.mart.module.purchaseorder.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.purchaseorder.dto.CreatePurchaseOrderRequest;
import com.mart.module.purchaseorder.dto.PurchaseOrderResponse;
import com.mart.module.purchaseorder.dto.ReceiveItemsRequest;
import com.mart.module.purchaseorder.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<PurchaseOrderResponse>>> getOrders(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(purchaseOrderService.getOrders(storeId, page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> getOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(purchaseOrderService.getOrder(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> createOrder(
            @Valid @RequestBody CreatePurchaseOrderRequest req) {
        return ResponseEntity.ok(ApiResponse.success(purchaseOrderService.createOrder(req)));
    }

    @PostMapping("/{id}/order")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> markOrdered(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(purchaseOrderService.markOrdered(id)));
    }

    @PostMapping("/{id}/receive")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> receiveItems(
            @PathVariable Long id,
            @RequestBody ReceiveItemsRequest req) {
        return ResponseEntity.ok(ApiResponse.success(purchaseOrderService.receiveItems(id, req)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> cancelOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(purchaseOrderService.cancelOrder(id)));
    }

    /** Auto-create a PO for all low-stock products. */
    @PostMapping("/from-low-stock")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> fromLowStock(
            @RequestBody java.util.Map<String, Object> body) {
        Long storeId    = Long.valueOf(body.get("storeId").toString());
        Long supplierId = Long.valueOf(body.get("supplierId").toString());
        String notes    = body.containsKey("notes") ? body.get("notes").toString() : null;
        return ResponseEntity.ok(ApiResponse.success(
                purchaseOrderService.fromLowStock(storeId, supplierId, notes)));
    }
}
