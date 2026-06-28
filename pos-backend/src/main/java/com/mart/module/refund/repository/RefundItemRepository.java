package com.mart.module.refund.repository;

import com.mart.module.refund.entity.RefundItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefundItemRepository extends JpaRepository<RefundItem, Long> {
}
