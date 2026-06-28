package com.mart.module.inventory.repository;

import com.mart.module.inventory.entity.MovementType;
import com.mart.module.inventory.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    Page<StockMovement> findByStoreIdAndProductIdOrderByCreatedAtDesc(
            Long storeId, Long productId, Pageable pageable);

    Page<StockMovement> findByStoreIdOrderByCreatedAtDesc(Long storeId, Pageable pageable);

    Page<StockMovement> findByStoreIdAndMovementTypeOrderByCreatedAtDesc(
            Long storeId, MovementType movementType, Pageable pageable);
}
