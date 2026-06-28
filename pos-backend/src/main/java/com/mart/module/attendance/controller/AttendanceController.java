package com.mart.module.attendance.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.attendance.dto.CashierSessionResponse;
import com.mart.module.attendance.dto.ClockInRequest;
import com.mart.module.attendance.dto.ClockOutRequest;
import com.mart.module.attendance.dto.UpdateSessionRequest;
import com.mart.module.attendance.service.AttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    /** Clock in the authenticated cashier at a store. */
    @PostMapping("/clock-in")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CashierSessionResponse>> clockIn(
            @Valid @RequestBody ClockInRequest req) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.clockIn(req)));
    }

    /** Clock out the authenticated cashier from a store. */
    @PostMapping("/clock-out")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CashierSessionResponse>> clockOut(
            @RequestParam Long storeId,
            @RequestBody(required = false) ClockOutRequest req) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.clockOut(storeId, req)));
    }

    /** Check whether the authenticated cashier is currently clocked in. */
    @GetMapping("/status")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CashierSessionResponse>> getStatus(
            @RequestParam Long storeId,
            @RequestParam Long cashierId) {
        return attendanceService.getActiveSession(storeId, cashierId)
                .map(s -> ResponseEntity.ok(ApiResponse.success(s)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.success(null)));
    }

    /** Correct a session's clock-in/out times. Admin/manager only. */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<CashierSessionResponse>> updateSession(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSessionRequest req) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.updateSession(id, req)));
    }

    /** Get session history filtered by cashier and/or date range. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<CashierSessionResponse>>> getHistory(
            @RequestParam Long storeId,
            @RequestParam(required = false) Long cashierId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size) {
        Instant fromInstant = from != null
                ? LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.now().minus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        Instant toInstant = to != null
                ? LocalDate.parse(to).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.getHistory(storeId, cashierId, fromInstant, toInstant, page, size)));
    }
}
