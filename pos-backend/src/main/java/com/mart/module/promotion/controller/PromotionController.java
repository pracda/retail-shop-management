package com.mart.module.promotion.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.promotion.dto.CreatePromotionRequest;
import com.mart.module.promotion.dto.PromotionResponse;
import com.mart.module.promotion.service.PromotionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/promotions")
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<PromotionResponse>>> getPromotions(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(promotionService.getPromotions(storeId, page, size)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PromotionResponse>> createPromotion(
            @Valid @RequestBody CreatePromotionRequest req) {
        return ResponseEntity.ok(ApiResponse.success(promotionService.createPromotion(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PromotionResponse>> updatePromotion(
            @PathVariable Long id,
            @Valid @RequestBody CreatePromotionRequest req) {
        return ResponseEntity.ok(ApiResponse.success(promotionService.updatePromotion(id, req)));
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PromotionResponse>> toggleActive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(promotionService.toggleActive(id)));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<List<PromotionResponse>>> getActivePromotions(@RequestParam Long storeId) {
        return ResponseEntity.ok(ApiResponse.success(promotionService.getActivePromotions(storeId)));
    }
}
