package com.mart.module.promotion.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.promotion.dto.CreatePromotionRequest;
import com.mart.module.promotion.dto.PromotionResponse;
import com.mart.module.promotion.entity.Promotion;
import com.mart.module.promotion.repository.PromotionRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public PageResponse<PromotionResponse> getPromotions(Long storeId, int page, int size) {
        return PageResponse.from(
                promotionRepository.findByStoreId(storeId, PageRequest.of(page, size))
                        .map(PromotionResponse::from));
    }

    @Transactional
    public PromotionResponse createPromotion(CreatePromotionRequest req) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        Promotion promotion = buildPromotion(req, store);
        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    @Transactional
    public PromotionResponse updatePromotion(Long id, CreatePromotionRequest req) {
        Promotion existing = promotionRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Promotion not found"));

        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        existing.setStore(store);
        existing.setName(req.name());
        existing.setDescription(req.description());
        existing.setPromoType(req.promoType());
        existing.setDiscountValue(req.discountValue());
        existing.setMinPurchase(req.minPurchase());
        existing.setMaxDiscount(req.maxDiscount());
        existing.setAppliesTo(req.appliesTo() != null ? req.appliesTo() : "ORDER");
        existing.setTargetId(req.targetId());
        existing.setBuyQuantity(req.buyQuantity());
        existing.setGetQuantity(req.getQuantity());
        existing.setStartsAt(req.startsAt());
        existing.setEndsAt(req.endsAt());

        return PromotionResponse.from(promotionRepository.save(existing));
    }

    @Transactional
    public PromotionResponse toggleActive(Long id) {
        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Promotion not found"));
        promotion.setIsActive(!promotion.getIsActive());
        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> getActivePromotions(Long storeId) {
        return promotionRepository.findActiveByStoreId(storeId, Instant.now())
                .stream()
                .map(PromotionResponse::from)
                .toList();
    }

    private Promotion buildPromotion(CreatePromotionRequest req, Store store) {
        return Promotion.builder()
                .store(store)
                .name(req.name())
                .description(req.description())
                .promoType(req.promoType())
                .discountValue(req.discountValue())
                .minPurchase(req.minPurchase())
                .maxDiscount(req.maxDiscount())
                .appliesTo(req.appliesTo() != null ? req.appliesTo() : "ORDER")
                .targetId(req.targetId())
                .buyQuantity(req.buyQuantity())
                .getQuantity(req.getQuantity())
                .startsAt(req.startsAt())
                .endsAt(req.endsAt())
                .isActive(true)
                .build();
    }
}
