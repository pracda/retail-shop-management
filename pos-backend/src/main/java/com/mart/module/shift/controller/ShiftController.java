package com.mart.module.shift.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.shift.dto.request.CloseShiftRequest;
import com.mart.module.shift.dto.request.OpenShiftRequest;
import com.mart.module.shift.dto.response.CashReconciliationResponse;
import com.mart.module.shift.dto.response.ShiftResponse;
import com.mart.module.shift.entity.ShiftStatus;
import com.mart.module.shift.repository.ShiftRepository;
import com.mart.module.shift.service.ShiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/shifts")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftService shiftService;
    private final ShiftRepository shiftRepository;

    /** Open the store shift (one per store). Manager/admin only. */
    @PostMapping("/open")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ShiftResponse>> openShift(@Valid @RequestBody OpenShiftRequest req) {
        return ResponseEntity.ok(ApiResponse.success(shiftService.openShift(req)));
    }

    /** Close the store shift. Manager/admin only. */
    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ShiftResponse>> closeShift(
            @PathVariable Long id,
            @Valid @RequestBody CloseShiftRequest req) {
        return ResponseEntity.ok(ApiResponse.success(shiftService.closeShift(id, req)));
    }

    /** Get the currently open store shift. All roles — needed by cashiers to get the shiftId for sales. */
    @GetMapping("/current")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<ShiftResponse>> getCurrentShift(@RequestParam Long storeId) {
        return shiftService.getCurrentShift(storeId)
                .map(shift -> ResponseEntity.ok(ApiResponse.success(shift)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.success(null)));
    }

    /** Get a specific shift by ID. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ShiftResponse>> getShift(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(shiftService.getShift(id)));
    }

    /** Count of currently open shifts for a store. */
    @GetMapping("/active-count")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<Long>> getActiveCount(@RequestParam Long storeId) {
        return ResponseEntity.ok(ApiResponse.success(
                shiftRepository.countByStoreIdAndStatus(storeId, ShiftStatus.OPEN)));
    }

    /** Cash reconciliation for a specific shift — expected vs actual cash. */
    @GetMapping("/{id}/reconciliation")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<CashReconciliationResponse>> getReconciliation(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(shiftService.getReconciliation(id)));
    }

    /** Paginated shift history for a store. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<ShiftResponse>>> getShiftHistory(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(shiftService.getShiftHistory(storeId, page, size)));
    }
}
