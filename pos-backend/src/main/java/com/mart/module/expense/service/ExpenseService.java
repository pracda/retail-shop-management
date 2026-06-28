package com.mart.module.expense.service;

import com.mart.common.exception.AppException;
import com.mart.module.expense.dto.CreateExpenseRequest;
import com.mart.module.expense.dto.ExpenseResponse;
import com.mart.module.expense.entity.ShiftExpense;
import com.mart.module.expense.repository.ShiftExpenseRepository;
import com.mart.module.shift.entity.Shift;
import com.mart.module.shift.repository.ShiftRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ShiftExpenseRepository expenseRepository;
    private final StoreRepository storeRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;

    @Transactional
    public ExpenseResponse recordExpense(CreateExpenseRequest req, Long userId) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));
        Shift shift = shiftRepository.findById(req.shiftId())
                .orElseThrow(() -> AppException.notFound("Shift not found"));
        User recordedBy = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("User not found"));

        ShiftExpense expense = ShiftExpense.builder()
                .store(store)
                .shift(shift)
                .recordedBy(recordedBy)
                .description(req.description())
                .amount(req.amount())
                .category(req.category())
                .build();

        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> getExpensesForShift(Long shiftId) {
        return expenseRepository.findByShiftId(shiftId).stream()
                .map(ExpenseResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BigDecimal getTotalExpensesForShift(Long shiftId) {
        return expenseRepository.sumAmountByShiftId(shiftId);
    }
}
