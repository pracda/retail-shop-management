package com.mart.module.store.entity;

import com.mart.common.audit.Auditable;
import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "stores")
public class Store extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 255)
    private String address;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /** Fractional tax rate applied to taxable products, e.g. 0.13 for 13% VAT. */
    @Column(name = "tax_rate", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal taxRate = BigDecimal.ZERO;

    /**
     * This store's own Secure LLM API Gateway key for the AI assistant. When blank, the
     * assistant falls back to the server-wide default key. Never exposed in API responses
     * (masked to a preview).
     */
    @Column(name = "assistant_gateway_api_key", length = 255)
    private String assistantGatewayApiKey;
}