package com.mart.module.sale.repository;

import com.mart.module.sale.entity.Sale;
import com.mart.module.sale.entity.SaleStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    /**
     * Sum of CASH payments on COMPLETED sales for a given shift.
     * Used for cash reconciliation.
     */
    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM SalePayment p
            WHERE p.sale.shift.id = :shiftId
              AND p.sale.status = com.mart.module.sale.entity.SaleStatus.COMPLETED
              AND p.paymentMethod = com.mart.module.sale.entity.PaymentMethod.CASH
            """)
    BigDecimal sumCashPaymentsByShift(@Param("shiftId") Long shiftId);

    @Query("""
            SELECT s FROM Sale s
            WHERE s.store.id = :storeId
              AND (:status IS NULL OR s.status = :status)
              AND (:from IS NULL OR s.createdAt >= :from)
              AND (:to IS NULL OR s.createdAt <= :to)
            ORDER BY s.createdAt DESC
            """)
    Page<Sale> findByStoreId(
            @Param("storeId") Long storeId,
            @Param("status") SaleStatus status,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable
    );

    @Query("""
            SELECT s FROM Sale s
            WHERE s.shift.id = :shiftId
            ORDER BY s.createdAt DESC
            """)
    Page<Sale> findByShiftId(@Param("shiftId") Long shiftId, Pageable pageable);
}
