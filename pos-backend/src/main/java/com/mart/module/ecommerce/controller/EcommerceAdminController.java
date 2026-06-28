package com.mart.module.ecommerce.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.ecommerce.dto.response.OnlineOrderDailyRow;
import com.mart.module.ecommerce.dto.response.OnlineOrderResponse;
import com.mart.module.ecommerce.dto.response.OnlineOrderSummaryResponse;
import com.mart.module.ecommerce.entity.OnlineOrderStatus;
import com.mart.module.ecommerce.service.EcommerceAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/ecommerce/admin/orders")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
public class EcommerceAdminController {

    private final EcommerceAdminService adminService;

    @GetMapping("/pending-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getPendingCount(@RequestParam Long storeId) {
        long count = adminService.getPendingCount(storeId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("pendingCount", count)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<OnlineOrderResponse>>> listOrders(
            @RequestParam Long storeId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "30days") String range,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Instant[] period = parsePeriod(range, from, to);
        OnlineOrderStatus statusEnum = status != null ? OnlineOrderStatus.valueOf(status) : null;
        var pageable = PageRequest.of(page, size, Sort.by("placedAt").descending());

        return ResponseEntity.ok(ApiResponse.success(
                adminService.listOrders(storeId, statusEnum, period[0], period[1], pageable)));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<OnlineOrderSummaryResponse>> getSummary(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "30days") String range,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        Instant[] period = parsePeriod(range, from, to);
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getSummary(storeId, period[0], period[1])));
    }

    @GetMapping("/daily-trend")
    public ResponseEntity<ApiResponse<List<OnlineOrderDailyRow>>> getDailyTrend(
            @RequestParam Long storeId,
            @RequestParam(defaultValue = "30days") String range,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        Instant[] period = parsePeriod(range, from, to);
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getDailyTrend(storeId, period[0], period[1])));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> getOrder(
            @RequestParam Long storeId,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getOrder(storeId, id)));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> confirmOrder(
            @RequestParam Long storeId,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.confirmOrder(storeId, id)));
    }

    @PostMapping("/{id}/fulfill")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> fulfillOrder(
            @RequestParam Long storeId,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.fulfillOrder(storeId, id)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OnlineOrderResponse>> cancelOrder(
            @RequestParam Long storeId,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.getOrDefault("reason", null) : null;
        return ResponseEntity.ok(ApiResponse.success(adminService.cancelOrder(storeId, id, reason)));
    }

    // ── Helper ─────────────────────────────────────────────────────────────────

    private Instant[] parsePeriod(String range, String from, String to) {
        if (from != null && to != null) {
            return new Instant[]{ Instant.parse(from), Instant.parse(to) };
        }
        Instant now = Instant.now();
        Instant start = switch (range) {
            case "today"     -> now.truncatedTo(java.time.temporal.ChronoUnit.DAYS);
            case "7days"     -> now.minus(6, java.time.temporal.ChronoUnit.DAYS)
                                   .truncatedTo(java.time.temporal.ChronoUnit.DAYS);
            case "thisMonth" -> {
                java.time.LocalDate ld = java.time.LocalDate.now();
                yield ld.withDayOfMonth(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
            }
            default          -> now.minus(29, java.time.temporal.ChronoUnit.DAYS)
                                   .truncatedTo(java.time.temporal.ChronoUnit.DAYS);
        };
        return new Instant[]{ start, now };
    }
}
