package com.mart.module.product.entity;

import com.mart.common.audit.Auditable;
import com.mart.module.category.entity.Category;
import com.mart.module.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "products")
public class Product extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String barcode;

    @Column(length = 50)
    private String sku;

    @Enumerated(EnumType.STRING)
    @Column(name = "base_unit", nullable = false, length = 10)
    @Builder.Default
    private ProductUnit baseUnit = ProductUnit.UNIT;

    /** How many base units make one pack. E.g. 12 cans per pack. */
    @Column(name = "units_per_pack", nullable = false)
    @Builder.Default
    private Integer unitsPerPack = 1;

    /** How many packs make one carton. E.g. 10 packs per carton. */
    @Column(name = "packs_per_carton", nullable = false)
    @Builder.Default
    private Integer packsPerCarton = 1;

    /**
     * Loyalty points multiplier for this product.
     * 1 = default (1 pt per Rs.100), 2 = double points, 0 = no points earned.
     */
    @Column(name = "loyalty_multiplier", nullable = false)
    @Builder.Default
    private Integer loyaltyMultiplier = 1;

    @Column(name = "cost_price", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal costPrice = BigDecimal.ZERO;

    @Column(name = "selling_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal sellingPrice;

    @Column(name = "low_stock_threshold", nullable = false)
    @Builder.Default
    private Integer lowStockThreshold = 10;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /** NULL = use store default tax rate. */
    @Column(name = "tax_rate", precision = 6, scale = 4)
    private BigDecimal taxRate;

    @Column(name = "is_taxable", nullable = false)
    @Builder.Default
    private Boolean isTaxable = true;

    /** NULL = standalone product. Set = this is a variant of the parent. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_product_id")
    private Product parentProduct;

    /** e.g. "Red / Large" — populated for variant products. */
    @Column(name = "variant_name", length = 200)
    private String variantName;
}
