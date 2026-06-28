package com.mart.module.purchaseorder.repository;

import com.mart.module.purchaseorder.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    Page<PurchaseOrder> findByStoreId(Long storeId, Pageable pageable);
}
