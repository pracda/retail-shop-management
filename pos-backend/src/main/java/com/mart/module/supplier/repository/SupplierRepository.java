package com.mart.module.supplier.repository;

import com.mart.module.supplier.entity.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    Page<Supplier> findByStoreId(Long storeId, Pageable pageable);

    List<Supplier> findByStoreIdAndIsActiveTrue(Long storeId);
}
