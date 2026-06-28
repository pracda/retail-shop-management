package com.mart.module.product.repository;

import com.mart.module.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Page<Product> findByStoreId(Long storeId, Pageable pageable);

    Page<Product> findByStoreIdAndCategoryId(Long storeId, Long categoryId, Pageable pageable);

    Page<Product> findByStoreIdAndIsActive(Long storeId, Boolean isActive, Pageable pageable);

    @Query("""
            SELECT p FROM Product p
            WHERE p.store.id = :storeId
              AND p.isActive = true
              AND (:categoryId IS NULL OR p.category.id = :categoryId)
              AND (:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR p.barcode = :search)
              AND (:onlyParents = false OR p.parentProduct IS NULL)
            """)
    Page<Product> findFiltered(@Param("storeId") Long storeId,
                               @Param("categoryId") Long categoryId,
                               @Param("search") String search,
                               @Param("onlyParents") boolean onlyParents,
                               Pageable pageable);

    @Query("""
            SELECT p FROM Product p
            WHERE p.store.id = :storeId
              AND (:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR p.barcode = :search)
            """)
    Page<Product> search(@Param("storeId") Long storeId,
                         @Param("search") String search,
                         Pageable pageable);

    Optional<Product> findByStoreIdAndBarcode(Long storeId, String barcode);

    boolean existsByStoreIdAndBarcode(Long storeId, String barcode);

    boolean existsByStoreIdAndBarcodeAndIdNot(Long storeId, String barcode, Long id);

    boolean existsByStoreIdAndSku(Long storeId, String sku);

    boolean existsByStoreIdAndSkuAndIdNot(Long storeId, String sku, Long id);

    List<Product> findByParentProductId(Long parentProductId);

    long countByParentProductId(Long parentProductId);

    /** Returns [parentProductId, variantCount] pairs for the given parent IDs in one query. */
    @Query("SELECT p.parentProduct.id, COUNT(p) FROM Product p WHERE p.parentProduct.id IN :parentIds GROUP BY p.parentProduct.id")
    List<Object[]> countVariantsByParentIds(@Param("parentIds") List<Long> parentIds);
}
