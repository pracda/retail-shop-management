package com.mart.module.inventory.service;

import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class LowStockAlertService {

    private final StoreRepository storeRepository;
    private final StockBalanceRepository stockBalanceRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public LowStockAlertService(StoreRepository storeRepository,
                                 StockBalanceRepository stockBalanceRepository) {
        this.storeRepository = storeRepository;
        this.stockBalanceRepository = stockBalanceRepository;
    }

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional(readOnly = true)
    public void sendLowStockAlerts() {
        List<Store> activeStores = storeRepository.findByIsActiveTrue();
        for (Store store : activeStores) {
            try {
                procesStore(store);
            } catch (Exception e) {
                log.error("Error sending low stock alert for store {}: {}", store.getId(), e.getMessage());
            }
        }
    }

    private void procesStore(Store store) {
        var lowStockItems = stockBalanceRepository.findLowStock(store.getId(), Pageable.unpaged())
                .getContent();

        if (lowStockItems.isEmpty()) {
            return;
        }

        if (store.getEmail() == null || store.getEmail().isBlank()) {
            log.info("Store {} has low stock items but no email configured", store.getId());
            return;
        }

        StringBuilder body = new StringBuilder("Low Stock Alert for " + store.getName() + "\n\n");
        body.append("The following products are running low:\n\n");

        for (var item : lowStockItems) {
            body.append(String.format("- %s: %.0f units (threshold: %d)\n",
                    item.getProduct().getName(),
                    item.getQuantity().doubleValue(),
                    item.getProduct().getLowStockThreshold()));
        }

        if (mailSender == null) {
            log.info("Mail not configured — skipping email for store {}", store.getId());
            log.info("Low stock items: {}", body);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(store.getEmail());
            message.setSubject("[POS] Low Stock Alert — " + store.getName());
            message.setText(body.toString());
            mailSender.send(message);
            log.info("Low stock alert sent to {} for store {}", store.getEmail(), store.getId());
        } catch (Exception e) {
            log.warn("Failed to send email to {}: {}", store.getEmail(), e.getMessage());
        }
    }
}
