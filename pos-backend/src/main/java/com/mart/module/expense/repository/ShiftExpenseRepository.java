package com.mart.module.expense.repository;

import com.mart.module.expense.entity.ShiftExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface ShiftExpenseRepository extends JpaRepository<ShiftExpense, Long> {

    List<ShiftExpense> findByShiftId(Long shiftId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM ShiftExpense e WHERE e.shift.id = :shiftId")
    BigDecimal sumAmountByShiftId(@Param("shiftId") Long shiftId);
}
