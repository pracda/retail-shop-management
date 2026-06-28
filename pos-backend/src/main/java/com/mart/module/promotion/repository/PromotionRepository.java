package com.mart.module.promotion.repository;

import com.mart.module.promotion.entity.Promotion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    Page<Promotion> findByStoreId(Long storeId, Pageable pageable);

    @Query("""
            SELECT p FROM Promotion p
            WHERE p.store.id = :storeId
              AND p.isActive = true
              AND p.startsAt <= :now
              AND (p.endsAt IS NULL OR p.endsAt > :now)
            """)
    List<Promotion> findActiveByStoreId(@Param("storeId") Long storeId, @Param("now") Instant now);
}
