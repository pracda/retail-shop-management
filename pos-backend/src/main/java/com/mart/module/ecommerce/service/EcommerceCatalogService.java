package com.mart.module.ecommerce.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.category.dto.response.CategoryResponse;
import com.mart.module.category.repository.CategoryRepository;
import com.mart.module.ecommerce.dto.response.CatalogProductResponse;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.product.entity.Product;
import com.mart.module.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EcommerceCatalogService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final StockBalanceRepository stockBalanceRepository;

    @Transactional(readOnly = true)
    public PageResponse<CatalogProductResponse> getProducts(
            Long storeId, Long categoryId, String search, Pageable pageable) {

        Page<Product> page = productRepository.findFiltered(
                storeId,
                categoryId,
                StringUtils.hasText(search) ? search.trim() : null,
                false,
                pageable);

        var ids = page.getContent().stream().map(Product::getId).toList();
        Map<Long, Integer> variantCounts = ids.isEmpty() ? Map.of() :
                productRepository.countVariantsByParentIds(ids).stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> ((Long) row[1]).intValue()));

        return PageResponse.from(page.map(p -> toResponse(p, variantCounts.getOrDefault(p.getId(), 0))));
    }

    @Transactional(readOnly = true)
    public CatalogProductResponse getProduct(Long storeId, Long productId) {
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> AppException.notFound("Product not found"));
        if (!p.getStore().getId().equals(storeId) || !Boolean.TRUE.equals(p.getIsActive())) {
            throw AppException.notFound("Product not found");
        }
        int variantCount = (int) productRepository.countByParentProductId(productId);
        return toResponse(p, variantCount);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories(Long storeId) {
        return categoryRepository.findByStoreIdAndIsActiveTrue(storeId)
                .stream()
                .map(c -> CategoryResponse.builder()
                        .id(c.getId())
                        .storeId(c.getStore().getId())
                        .name(c.getName())
                        .description(c.getDescription())
                        .isActive(c.getIsActive())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogProductResponse> getVariants(Long storeId, Long parentId) {
        Product parent = productRepository.findById(parentId)
                .orElseThrow(() -> AppException.notFound("Product not found"));
        if (!parent.getStore().getId().equals(storeId)) throw AppException.notFound("Product not found");

        return productRepository.findByParentProductId(parentId).stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .map(p -> toResponse(p, 0))
                .toList();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private CatalogProductResponse toResponse(Product p, int variantCount) {
        var stockOpt = stockBalanceRepository.findByStoreIdAndProductId(p.getStore().getId(), p.getId());
        BigDecimal stock = stockOpt.map(sb -> sb.getQuantity()).orElse(BigDecimal.ZERO);

        return CatalogProductResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .barcode(p.getBarcode())
                .sku(p.getSku())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .sellingPrice(p.getSellingPrice())
                .currentStock(stock)
                .inStock(stock.compareTo(BigDecimal.ZERO) > 0)
                .variantCount(variantCount)
                .parentProductId(p.getParentProduct() != null ? p.getParentProduct().getId() : null)
                .variantName(p.getVariantName())
                .isTaxable(p.getIsTaxable())
                .taxRate(p.getTaxRate())
                .build();
    }
}
