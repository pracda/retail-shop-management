package com.mart.module.sale.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.sale.dto.request.CreateSaleRequest;
import com.mart.module.sale.dto.request.VoidSaleRequest;
import com.mart.module.sale.dto.response.SaleResponse;
import com.mart.module.sale.entity.SaleStatus;
import com.mart.module.sale.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    /** Create a sale — all roles (cashiers process sales). */
    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<SaleResponse>> createSale(@Valid @RequestBody CreateSaleRequest req) {
        return ResponseEntity.ok(ApiResponse.success(saleService.createSale(req)));
    }

    /** Get a single sale by ID. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<SaleResponse>> getSale(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(saleService.getSale(id)));
    }

    /** Paginated sale history for a store — managers and above. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<SaleResponse>>> getSales(
            @RequestParam Long storeId,
            @RequestParam(required = false) SaleStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                saleService.getSales(storeId, status, from, to, page, size)));
    }

    /** Sales within a specific shift. */
    @GetMapping("/shift/{shiftId}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<PageResponse<SaleResponse>>> getShiftSales(
            @PathVariable Long shiftId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(saleService.getShiftSales(shiftId, page, size)));
    }

    /** Void a sale — managers and above only. */
    @PostMapping("/{id}/void")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<SaleResponse>> voidSale(
            @PathVariable Long id,
            @Valid @RequestBody VoidSaleRequest req) {
        return ResponseEntity.ok(ApiResponse.success(saleService.voidSale(id, req)));
    }

    /** Email a receipt to a customer. */
    @PostMapping("/{id}/email-receipt")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<Void>> emailReceipt(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        saleService.emailReceipt(id, body.get("email"));
        return ResponseEntity.ok(ApiResponse.success("Receipt sent", null));
    }
}
