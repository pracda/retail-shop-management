package com.mart.module.product.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.audit.service.AuditLogService;
import com.mart.module.category.entity.Category;
import com.mart.module.category.repository.CategoryRepository;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.product.dto.request.CreateProductRequest;
import com.mart.module.product.dto.request.UpdateProductRequest;
import com.mart.module.product.dto.response.ProductResponse;
import com.mart.module.product.entity.Product;
import com.mart.module.product.entity.ProductUnit;
import com.mart.module.product.repository.ProductRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getProducts(Long storeId, Long categoryId,
                                                     String search, Pageable pageable) {
        return getProducts(storeId, categoryId, search, false, pageable);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getProducts(Long storeId, Long categoryId,
                                                     String search, boolean onlyParents,
                                                     Pageable pageable) {
        var page = productRepository.findFiltered(
                storeId,
                categoryId,
                StringUtils.hasText(search) ? search.trim() : null,
                onlyParents,
                pageable);

        // Batch-fetch variant counts for all products on this page in one query
        var ids = page.getContent().stream().map(Product::getId).toList();
        Map<Long, Integer> variantCounts = ids.isEmpty() ? Map.of() :
                productRepository.countVariantsByParentIds(ids).stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> ((Long) row[1]).intValue()
                        ));

        return PageResponse.from(page.map(p -> toResponse(p, variantCounts.getOrDefault(p.getId(), 0))));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> getVariantsByParent(Long parentId) {
        Product parent = productRepository.findById(parentId)
                .orElseThrow(() -> AppException.notFound("Product not found"));
        return productRepository.findByParentProductId(parentId).stream()
                .map(v -> toResponse(v, 0))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductById(Long id) {
        return productRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> AppException.notFound("Product not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductByBarcode(Long storeId, String barcode) {
        return productRepository.findByStoreIdAndBarcode(storeId, barcode)
                .map(this::toResponse)
                .orElseThrow(() -> AppException.notFound("Product not found with barcode: " + barcode));
    }

    @Transactional
    public ProductResponse createProduct(CreateProductRequest request) {
        Store store = storeRepository.findById(request.getStoreId())
                .orElseThrow(() -> AppException.notFound("Store not found with id: " + request.getStoreId()));

        if (StringUtils.hasText(request.getBarcode())
                && productRepository.existsByStoreIdAndBarcode(store.getId(), request.getBarcode())) {
            throw AppException.conflict("Barcode '" + request.getBarcode() + "' is already in use");
        }

        if (StringUtils.hasText(request.getSku())
                && productRepository.existsByStoreIdAndSku(store.getId(), request.getSku())) {
            throw AppException.conflict("SKU '" + request.getSku() + "' is already in use");
        }

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> AppException.notFound("Category not found with id: " + request.getCategoryId()));
        }

        Product parentProduct = null;
        if (request.getParentProductId() != null) {
            parentProduct = productRepository.findById(request.getParentProductId())
                    .orElseThrow(() -> AppException.notFound("Parent product not found"));
        }

        Product product = Product.builder()
                .store(store)
                .category(category)
                .name(request.getName().trim())
                .description(request.getDescription())
                .barcode(request.getBarcode())
                .sku(request.getSku())
                .baseUnit(request.getBaseUnit() != null ? request.getBaseUnit() : ProductUnit.UNIT)
                .unitsPerPack(request.getUnitsPerPack() != null ? request.getUnitsPerPack() : 1)
                .packsPerCarton(request.getPacksPerCarton() != null ? request.getPacksPerCarton() : 1)
                .loyaltyMultiplier(request.getLoyaltyMultiplier() != null ? request.getLoyaltyMultiplier() : 1)
                .costPrice(request.getCostPrice())
                .sellingPrice(request.getSellingPrice())
                .lowStockThreshold(request.getLowStockThreshold() != null ? request.getLowStockThreshold() : 10)
                .isActive(true)
                .taxRate(request.getTaxRate())
                .isTaxable(request.getIsTaxable() != null ? request.getIsTaxable() : true)
                .parentProduct(parentProduct)
                .variantName(request.getVariantName())
                .build();

        Product saved = productRepository.save(product);
        log.info("Product created: '{}' (barcode: {}) in store {}", saved.getName(), saved.getBarcode(), store.getId());
        auditLogService.log(store.getId(), "CREATE", "PRODUCT", saved.getId(), "Created: " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public ProductResponse updateProduct(Long id, UpdateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Product not found with id: " + id));

        if (StringUtils.hasText(request.getBarcode())
                && productRepository.existsByStoreIdAndBarcodeAndIdNot(
                        product.getStore().getId(), request.getBarcode(), id)) {
            throw AppException.conflict("Barcode '" + request.getBarcode() + "' is already in use");
        }

        if (StringUtils.hasText(request.getSku())
                && productRepository.existsByStoreIdAndSkuAndIdNot(
                        product.getStore().getId(), request.getSku(), id)) {
            throw AppException.conflict("SKU '" + request.getSku() + "' is already in use");
        }

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> AppException.notFound("Category not found with id: " + request.getCategoryId()));
        }

        product.setCategory(category);
        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setBarcode(request.getBarcode());
        product.setSku(request.getSku());
        if (request.getBaseUnit() != null)           product.setBaseUnit(request.getBaseUnit());
        if (request.getUnitsPerPack() != null)       product.setUnitsPerPack(request.getUnitsPerPack());
        if (request.getPacksPerCarton() != null)     product.setPacksPerCarton(request.getPacksPerCarton());
        if (request.getLoyaltyMultiplier() != null)  product.setLoyaltyMultiplier(request.getLoyaltyMultiplier());
        product.setCostPrice(request.getCostPrice());
        product.setSellingPrice(request.getSellingPrice());
        if (request.getLowStockThreshold() != null) product.setLowStockThreshold(request.getLowStockThreshold());
        if (request.getTaxRate() != null) product.setTaxRate(request.getTaxRate());
        if (request.getIsTaxable() != null) product.setIsTaxable(request.getIsTaxable());

        Product updated = productRepository.save(product);
        auditLogService.log(updated.getStore().getId(), "UPDATE", "PRODUCT", updated.getId(),
                "Updated: " + updated.getName() + " price=" + updated.getSellingPrice());
        return toResponse(updated);
    }

    @Transactional
    public void setProductStatus(Long id, boolean active) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Product not found with id: " + id));
        product.setIsActive(active);
        productRepository.save(product);
        log.info("Product {} status set to active={}", id, active);
    }

    public record ImportResult(int imported, int failed, List<String> errors) {}

    /**
     * Import products from CSV.
     * Expected header: name,barcode,sku,sellingPrice,costPrice,categoryName
     */
    @Transactional
    public ImportResult importCsv(Long storeId, MultipartFile file) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> AppException.notFound("Store not found"));

        int imported = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) throw AppException.badRequest("CSV file is empty");

            String line;
            int row = 1;
            while ((line = reader.readLine()) != null) {
                row++;
                if (line.isBlank()) continue;
                String[] cols = line.split(",", -1);
                if (cols.length < 4) {
                    errors.add("Row " + row + ": need at least 4 columns (name,barcode,sku,sellingPrice)");
                    failed++;
                    continue;
                }
                try {
                    String name       = cols[0].trim();
                    String barcode    = cols.length > 1 ? cols[1].trim() : "";
                    String sku        = cols.length > 2 ? cols[2].trim() : "";
                    BigDecimal sell   = new BigDecimal(cols[3].trim());
                    BigDecimal cost   = cols.length > 4 && !cols[4].isBlank()
                                        ? new BigDecimal(cols[4].trim()) : BigDecimal.ZERO;

                    if (name.isEmpty()) { errors.add("Row " + row + ": name is blank"); failed++; continue; }

                    // Skip duplicate barcodes
                    if (!barcode.isEmpty() && productRepository.existsByStoreIdAndBarcode(storeId, barcode)) {
                        errors.add("Row " + row + ": barcode '" + barcode + "' already exists — skipped");
                        failed++;
                        continue;
                    }

                    Product p = Product.builder()
                            .store(store)
                            .name(name)
                            .barcode(barcode.isEmpty() ? null : barcode)
                            .sku(sku.isEmpty() ? null : sku)
                            .sellingPrice(sell)
                            .costPrice(cost)
                            .isActive(true)
                            .isTaxable(true)
                            .unitsPerPack(1)
                            .packsPerCarton(1)
                            .lowStockThreshold(10)
                            .build();
                    productRepository.save(p);
                    imported++;
                } catch (Exception e) {
                    errors.add("Row " + row + ": " + e.getMessage());
                    failed++;
                }
            }
        } catch (java.io.IOException e) {
            throw AppException.badRequest("Failed to read CSV: " + e.getMessage());
        }

        auditLogService.log(storeId, "IMPORT", "PRODUCT", null,
                "CSV import: " + imported + " imported, " + failed + " failed");
        return new ImportResult(imported, failed, errors);
    }

    private ProductResponse toResponse(Product p) {
        int variantCount = (int) productRepository.countByParentProductId(p.getId());
        return toResponse(p, variantCount);
    }

    private ProductResponse toResponse(Product p, int variantCount) {
        var stockOpt = stockBalanceRepository.findByStoreIdAndProductId(p.getStore().getId(), p.getId());
        return ProductResponse.builder()
                .id(p.getId())
                .storeId(p.getStore().getId())
                .storeName(p.getStore().getName())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .name(p.getName())
                .description(p.getDescription())
                .barcode(p.getBarcode())
                .sku(p.getSku())
                .baseUnit(p.getBaseUnit())
                .unitsPerPack(p.getUnitsPerPack())
                .packsPerCarton(p.getPacksPerCarton())
                .loyaltyMultiplier(p.getLoyaltyMultiplier())
                .costPrice(p.getCostPrice())
                .sellingPrice(p.getSellingPrice())
                .lowStockThreshold(p.getLowStockThreshold())
                .isActive(p.getIsActive())
                .taxRate(p.getTaxRate())
                .isTaxable(p.getIsTaxable())
                .parentProductId(p.getParentProduct() != null ? p.getParentProduct().getId() : null)
                .variantName(p.getVariantName())
                .variantCount(variantCount)
                .currentStock(stockOpt.map(sb -> sb.getQuantity()).orElse(java.math.BigDecimal.ZERO))
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
