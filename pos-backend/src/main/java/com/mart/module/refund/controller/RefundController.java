package com.mart.module.refund.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.refund.dto.CreateRefundRequest;
import com.mart.module.refund.dto.RejectRefundRequest;
import com.mart.module.refund.dto.RefundResponse;
import com.mart.module.refund.service.RefundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/refunds")
@RequiredArgsConstructor
public class RefundController {

    private final RefundService refundService;

    /** Cashier submits a refund request — creates PENDING, no side-effects yet. */
    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<RefundResponse>> createRefund(
            @Valid @RequestBody CreateRefundRequest req) {
        return ResponseEntity.ok(ApiResponse.success(refundService.createRefund(req)));
    }

    /** List all PENDING refunds for a store — managers and above. */
    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<RefundResponse>>> getPendingRefunds(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                refundService.getPendingRefunds(storeId, page, size)));
    }

    /** Approve a pending refund — executes stock return + loyalty adjustment. */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<RefundResponse>> approveRefund(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(refundService.approveRefund(id)));
    }

    /** Reject a pending refund — no stock/loyalty changes. */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<RefundResponse>> rejectRefund(
            @PathVariable Long id,
            @Valid @RequestBody RejectRefundRequest req) {
        return ResponseEntity.ok(ApiResponse.success(refundService.rejectRefund(id, req)));
    }

    /** All refunds (any status) for a specific sale. */
    @GetMapping("/sale/{saleId}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<List<RefundResponse>>> getRefundsForSale(@PathVariable Long saleId) {
        return ResponseEntity.ok(ApiResponse.success(refundService.getRefundsForSale(saleId)));
    }
}
