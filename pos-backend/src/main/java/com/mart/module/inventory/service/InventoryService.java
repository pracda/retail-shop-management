package com.mart.module.inventory.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.inventory.dto.request.AdjustStockRequest;
import com.mart.module.inventory.dto.request.ReceiveStockRequest;
import com.mart.module.inventory.dto.response.StockBalanceResponse;
import com.mart.module.inventory.dto.response.StockMovementResponse;
import com.mart.module.inventory.entity.MovementType;
import com.mart.module.inventory.entity.StockBalance;
import com.mart.module.inventory.entity.StockMovement;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.inventory.repository.StockMovementRepository;
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

import java.math.BigDecimal;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final StockBalanceRepository stockBalanceRepository;
    private final StockMovementRepository stockMovementRepository;
    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;

    // ── Queries ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StockBalanceResponse getStockByProduct(Long storeId, Long productId) {
        StockBalance balance = stockBalanceRepository
                .findByStoreIdAndProductId(storeId, productId)
                .orElseGet(() -> emptyBalance(storeId, productId));
        return toBalanceResponse(balance);
    }

    @Transactional(readOnly = true)
    public PageResponse<StockBalanceResponse> getAllStock(Long storeId, Pageable pageable) {
        return PageResponse.from(
                stockBalanceRepository.findByStoreId(storeId, pageable)
                        .map(this::toBalanceResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<StockBalanceResponse> getLowStock(Long storeId, Pageable pageable) {
        return PageResponse.from(
                stockBalanceRepository.findLowStock(storeId, pageable)
                        .map(this::toBalanceResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<StockMovementResponse> getMovements(Long storeId, Long productId, Pageable pageable) {
        var page = productId != null
                ? stockMovementRepository.findByStoreIdAndProductIdOrderByCreatedAtDesc(storeId, productId, pageable)
                : stockMovementRepository.findByStoreIdOrderByCreatedAtDesc(storeId, pageable);
        return PageResponse.from(page.map(this::toMovementResponse));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public StockBalanceResponse receiveStock(ReceiveStockRequest request) {
        Store store = storeRepository.findById(request.getStoreId())
                .orElseThrow(() -> AppException.notFound("Store not found"));
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> AppException.notFound("Product not found"));

        BigDecimal baseQuantity = toBaseUnits(request.getQuantity(),
                request.getReceivedUnit(), product);

        StockBalance balance = getOrCreateBalance(store, product);
        BigDecimal before = balance.getQuantity();
        BigDecimal after = before.add(baseQuantity);
        balance.setQuantity(after);
        stockBalanceRepository.save(balance);

        recordMovement(store, product, MovementType.RECEIVE, baseQuantity, before, after,
                null, request.getNote());

        log.info("Stock received: {} base units of product {} in store {}",
                baseQuantity, product.getId(), store.getId());
        return toBalanceResponse(balance);
    }

    @Transactional
    public StockBalanceResponse adjustStock(AdjustStockRequest request) {
        Store store = storeRepository.findById(request.getStoreId())
                .orElseThrow(() -> AppException.notFound("Store not found"));
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> AppException.notFound("Product not found"));

        if (request.getNewQuantity().compareTo(BigDecimal.ZERO) < 0) {
            throw AppException.badRequest("New quantity cannot be negative");
        }

        StockBalance balance = getOrCreateBalance(store, product);
        BigDecimal before = balance.getQuantity();
        BigDecimal delta = request.getNewQuantity().subtract(before);
        balance.setQuantity(request.getNewQuantity());
        stockBalanceRepository.save(balance);

        recordMovement(store, product, MovementType.ADJUSTMENT, delta, before,
                request.getNewQuantity(), null, request.getNote());

        log.info("Stock adjusted: product {} in store {} from {} to {}",
                product.getId(), store.getId(), before, request.getNewQuantity());
        return toBalanceResponse(balance);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Converts the received quantity to base units (UNIT) using the product's
     * conversion factors.
     */
    private BigDecimal toBaseUnits(BigDecimal qty, ProductUnit receivedUnit, Product product) {
        ProductUnit unit = receivedUnit != null ? receivedUnit : product.getBaseUnit();
        return switch (unit) {
            case CARTON -> qty
                    .multiply(BigDecimal.valueOf(product.getPacksPerCarton()))
                    .multiply(BigDecimal.valueOf(product.getUnitsPerPack()));
            case PACK   -> qty.multiply(BigDecimal.valueOf(product.getUnitsPerPack()));
            case UNIT   -> qty;
        };
    }

    private StockBalance getOrCreateBalance(Store store, Product product) {
        return stockBalanceRepository
                .findByStoreIdAndProductIdForUpdate(store.getId(), product.getId())
                .orElseGet(() -> StockBalance.builder()
                        .store(store)
                        .product(product)
                        .quantity(BigDecimal.ZERO)
                        .build());
    }

    private void recordMovement(Store store, Product product, MovementType type,
                                BigDecimal qty, BigDecimal before, BigDecimal after,
                                Long referenceId, String note) {
        stockMovementRepository.save(StockMovement.builder()
                .store(store)
                .product(product)
                .movementType(type)
                .quantity(qty)
                .quantityBefore(before)
                .quantityAfter(after)
                .referenceId(referenceId)
                .note(note)
                .build());
    }

    /** Returns a transient (unsaved) zero-balance object when no record exists yet. */
    private StockBalance emptyBalance(Long storeId, Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> AppException.notFound("Product not found"));
        Store store = storeRepository.getReferenceById(storeId);
        return StockBalance.builder()
                .store(store)
                .product(product)
                .quantity(BigDecimal.ZERO)
                .build();
    }

    private StockBalanceResponse toBalanceResponse(StockBalance b) {
        boolean isLow = b.getQuantity()
                .compareTo(BigDecimal.valueOf(b.getProduct().getLowStockThreshold())) <= 0;
        return StockBalanceResponse.builder()
                .id(b.getId())
                .storeId(b.getStore().getId())
                .productId(b.getProduct().getId())
                .productName(b.getProduct().getName())
                .productBarcode(b.getProduct().getBarcode())
                .categoryName(b.getProduct().getCategory() != null
                        ? b.getProduct().getCategory().getName() : null)
                .quantity(b.getQuantity())
                .lowStockThreshold(b.getProduct().getLowStockThreshold())
                .isLowStock(isLow)
                .updatedAt(b.getUpdatedAt())
                .build();
    }

    private StockMovementResponse toMovementResponse(StockMovement m) {
        return StockMovementResponse.builder()
                .id(m.getId())
                .storeId(m.getStore().getId())
                .productId(m.getProduct().getId())
                .productName(m.getProduct().getName())
                .movementType(m.getMovementType())
                .quantity(m.getQuantity())
                .quantityBefore(m.getQuantityBefore())
                .quantityAfter(m.getQuantityAfter())
                .referenceId(m.getReferenceId())
                .note(m.getNote())
                .createdAt(m.getCreatedAt())
                .createdBy(m.getCreatedBy())
                .build();
    }
}
