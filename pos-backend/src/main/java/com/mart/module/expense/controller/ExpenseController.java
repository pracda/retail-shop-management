package com.mart.module.expense.controller;

import com.mart.common.response.ApiResponse;
import com.mart.module.expense.dto.CreateExpenseRequest;
import com.mart.module.expense.dto.ExpenseResponse;
import com.mart.module.expense.service.ExpenseService;
import com.mart.module.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserRepository userRepository;

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<ExpenseResponse>> recordExpense(
            @Valid @RequestBody CreateExpenseRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        var user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(ApiResponse.success(expenseService.recordExpense(req, user.getId())));
    }

    @GetMapping("/shift/{shiftId}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<List<ExpenseResponse>>> getExpensesForShift(@PathVariable Long shiftId) {
        return ResponseEntity.ok(ApiResponse.success(expenseService.getExpensesForShift(shiftId)));
    }
}
