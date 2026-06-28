package com.mart.module.supplier.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.supplier.dto.CreateSupplierRequest;
import com.mart.module.supplier.dto.SupplierResponse;
import com.mart.module.supplier.dto.UpdateSupplierRequest;
import com.mart.module.supplier.service.SupplierService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierService supplierService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<SupplierResponse>>> getSuppliers(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(supplierService.getSuppliers(storeId, page, size)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> createSupplier(
            @Valid @RequestBody CreateSupplierRequest req) {
        return ResponseEntity.ok(ApiResponse.success(supplierService.createSupplier(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> updateSupplier(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSupplierRequest req) {
        return ResponseEntity.ok(ApiResponse.success(supplierService.updateSupplier(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateSupplier(@PathVariable Long id) {
        supplierService.deactivateSupplier(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
