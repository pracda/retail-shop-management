package com.mart.module.inventory.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.inventory.dto.request.AdjustStockRequest;
import com.mart.module.inventory.dto.request.ReceiveStockRequest;
import com.mart.module.inventory.dto.response.StockBalanceResponse;
import com.mart.module.inventory.dto.response.StockMovementResponse;
import com.mart.module.inventory.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/stock")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<PageResponse<StockBalanceResponse>>> getAllStock(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("product.name").ascending());
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getAllStock(storeId, pageable)));
    }

    @GetMapping("/stock/low")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<StockBalanceResponse>>> getLowStock(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getLowStock(storeId, pageable)));
    }

    @GetMapping("/stock/product/{productId}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<StockBalanceResponse>> getStockByProduct(
            @RequestParam Long storeId,
            @PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.success(
                inventoryService.getStockByProduct(storeId, productId)));
    }

    @PostMapping("/receive")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<StockBalanceResponse>> receiveStock(
            @Valid @RequestBody ReceiveStockRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Stock received successfully",
                inventoryService.receiveStock(request)));
    }

    @PostMapping("/adjust")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<StockBalanceResponse>> adjustStock(
            @Valid @RequestBody AdjustStockRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Stock adjusted successfully",
                inventoryService.adjustStock(request)));
    }

    @GetMapping("/movements")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<StockMovementResponse>>> getMovements(
            @RequestParam Long storeId,
            @RequestParam(required = false) Long productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.success(
                inventoryService.getMovements(storeId, productId, pageable)));
    }
}
