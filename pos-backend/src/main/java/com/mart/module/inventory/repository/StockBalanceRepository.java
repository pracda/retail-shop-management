package com.mart.module.inventory.repository;

import com.mart.module.inventory.entity.StockBalance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface StockBalanceRepository extends JpaRepository<StockBalance, Long> {

    Optional<StockBalance> findByStoreIdAndProductId(Long storeId, Long productId);

    /** Pessimistic write lock — used when updating stock to prevent race conditions. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM StockBalance s WHERE s.store.id = :storeId AND s.product.id = :productId")
    Optional<StockBalance> findByStoreIdAndProductIdForUpdate(@Param("storeId") Long storeId,
                                                               @Param("productId") Long productId);

    Page<StockBalance> findByStoreId(Long storeId, Pageable pageable);

    @Query("""
            SELECT s FROM StockBalance s
            WHERE s.store.id = :storeId
              AND s.quantity <= s.product.lowStockThreshold
            """)
    Page<StockBalance> findLowStock(@Param("storeId") Long storeId, Pageable pageable);
}
