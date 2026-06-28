package com.mart.module.report.controller;

import com.mart.common.response.ApiResponse;
import com.mart.module.report.dto.*;
import com.mart.module.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

// Note: from/to are ISO-8601 UTC strings (e.g. "2026-04-17T18:15:00.000Z"),
// parsed via Instant.parse() to avoid Spring MVC @DateTimeFormat quirks.

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
public class ReportController {

    private final ReportService reportService;

    // Accept from/to as plain ISO-8601 strings and parse to Instant here,
    // avoiding Spring MVC's @DateTimeFormat conversion quirks with Instant.

    @GetMapping("/sales-summary")
    public ResponseEntity<ApiResponse<SalesSummaryResponse>> getSalesSummary(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getSalesSummary(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/profit-loss")
    public ResponseEntity<ApiResponse<ProfitLossResponse>> getProfitLoss(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getProfitLoss(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/payment-breakdown")
    public ResponseEntity<ApiResponse<List<PaymentBreakdownItem>>> getPaymentBreakdown(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getPaymentBreakdown(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/top-products")
    public ResponseEntity<ApiResponse<List<TopProductRow>>> getTopProducts(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getTopProducts(storeId, Instant.parse(from), Instant.parse(to), limit)));
    }

    @GetMapping("/daily-trend")
    public ResponseEntity<ApiResponse<List<DailyTrendRow>>> getDailyTrend(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getDailyTrend(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/cashier-performance")
    public ResponseEntity<ApiResponse<List<CashierReportRow>>> getCashierPerformance(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getCashierPerformance(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<List<TransactionReportRow>>> getTransactions(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "100") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getTransactions(storeId, Instant.parse(from), Instant.parse(to),
                        paymentMethod, status, page, size)));
    }

    @GetMapping("/hourly-trend")
    public ResponseEntity<ApiResponse<List<HourlyTrendRow>>> getHourlyTrend(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getHourlyTrend(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/category-sales")
    public ResponseEntity<ApiResponse<List<CategorySalesRow>>> getCategorySales(
            @RequestParam Long storeId,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getCategorySales(storeId, Instant.parse(from), Instant.parse(to))));
    }

    @GetMapping("/z-report")
    public ResponseEntity<ApiResponse<ZReportResponse>> getZReport(
            @RequestParam Long storeId,
            @RequestParam String date) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.getZReport(storeId, LocalDate.parse(date))));
    }
}
