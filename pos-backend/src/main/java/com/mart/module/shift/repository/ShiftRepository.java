package com.mart.module.shift.repository;

import com.mart.module.shift.entity.Shift;
import com.mart.module.shift.entity.ShiftStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    /** Find the currently open shift for a cashier in a store. */
    Optional<Shift> findByStoreIdAndCashierIdAndStatus(Long storeId, Long cashierId, ShiftStatus status);

    /** Any open shift in the store (for manager override / close-all). */
    Optional<Shift> findFirstByStoreIdAndStatus(Long storeId, ShiftStatus status);

    /** Paginated shift history for a store. */
    @Query("""
            SELECT s FROM Shift s
            WHERE s.store.id = :storeId
            ORDER BY s.openedAt DESC
            """)
    Page<Shift> findByStoreId(@Param("storeId") Long storeId, Pageable pageable);

    boolean existsByStoreIdAndCashierIdAndStatus(Long storeId, Long cashierId, ShiftStatus status);

    long countByStoreIdAndStatus(Long storeId, ShiftStatus status);
}
