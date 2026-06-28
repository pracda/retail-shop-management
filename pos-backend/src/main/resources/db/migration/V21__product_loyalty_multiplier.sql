-- Per-product loyalty points multiplier (how many points per Rs.100 spent on this product)
ALTER TABLE products
    ADD COLUMN loyalty_multiplier TINYINT UNSIGNED NOT NULL DEFAULT 1
        COMMENT '1 = earn 1x points, 2 = earn 2x, etc. Default 1.'
    AFTER packs_per_carton;
