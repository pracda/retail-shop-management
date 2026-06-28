package com.mart.module.refund.repository;

import com.mart.module.refund.entity.Refund;
import com.mart.module.refund.entity.RefundStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface RefundRepository extends JpaRepository<Refund, Long> {

    List<Refund> findBySaleId(Long saleId);

    @Query("SELECT r FROM Refund r WHERE r.sale.store.id = :storeId AND r.status = :status ORDER BY r.createdAt DESC")
    Page<Refund> findByStoreIdAndStatus(@Param("storeId") Long storeId,
                                        @Param("status") RefundStatus status,
                                        Pageable pageable);

    /**
     * Sum of CASH refunds (APPROVED) for sales belonging to a specific shift.
     * Used for cash reconciliation.
     */
    @Query("""
            SELECT COALESCE(SUM(r.refundAmount), 0)
            FROM Refund r
            WHERE r.sale.shift.id = :shiftId
              AND r.status = com.mart.module.refund.entity.RefundStatus.APPROVED
              AND UPPER(r.refundMethod) = 'CASH'
            """)
    java.math.BigDecimal sumCashRefundsByShift(@Param("shiftId") Long shiftId);
}
