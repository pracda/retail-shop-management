package com.mart.module.attendance.repository;

import com.mart.module.attendance.entity.CashierSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface CashierSessionRepository extends JpaRepository<CashierSession, Long> {

    /** Find the active (not yet clocked-out) session for a cashier in a store. */
    Optional<CashierSession> findByStoreIdAndCashierIdAndClockedOutAtIsNull(Long storeId, Long cashierId);

    boolean existsByStoreIdAndCashierIdAndClockedOutAtIsNull(Long storeId, Long cashierId);

    @Query("""
            SELECT cs FROM CashierSession cs
            WHERE cs.store.id = :storeId
              AND cs.clockedInAt >= :from
              AND cs.clockedInAt < :to
            ORDER BY cs.clockedInAt DESC
            """)
    Page<CashierSession> findByStoreIdAndDateRange(@Param("storeId") Long storeId,
                                                    @Param("from") Instant from,
                                                    @Param("to") Instant to,
                                                    Pageable pageable);

    @Query("""
            SELECT cs FROM CashierSession cs
            WHERE cs.store.id = :storeId
              AND cs.cashier.id = :cashierId
              AND cs.clockedInAt >= :from
              AND cs.clockedInAt < :to
            ORDER BY cs.clockedInAt DESC
            """)
    Page<CashierSession> findByStoreIdAndCashierIdAndDateRange(@Param("storeId") Long storeId,
                                                                @Param("cashierId") Long cashierId,
                                                                @Param("from") Instant from,
                                                                @Param("to") Instant to,
                                                                Pageable pageable);
}
