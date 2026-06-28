package com.mart.module.category.repository;

import com.mart.module.category.entity.Category;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    Page<Category> findByStoreId(Long storeId, Pageable pageable);

    Page<Category> findByStoreIdAndIsActive(Long storeId, Boolean isActive, Pageable pageable);

    java.util.List<Category> findByStoreIdAndIsActiveTrue(Long storeId);

    boolean existsByStoreIdAndNameIgnoreCase(Long storeId, String name);

    boolean existsByStoreIdAndNameIgnoreCaseAndIdNot(Long storeId, String name, Long id);
}
