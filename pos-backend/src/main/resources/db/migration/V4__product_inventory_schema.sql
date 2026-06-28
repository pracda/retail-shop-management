-- ============================================================
-- V4: Product, Category, and Inventory schema
-- ============================================================

CREATE TABLE categories (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    store_id    BIGINT          NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    created_by  BIGINT,
    updated_by  BIGINT,
    PRIMARY KEY (id),
    UNIQUE  KEY uk_categories_store_name (store_id, name),
    CONSTRAINT fk_categories_store FOREIGN KEY (store_id) REFERENCES stores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id               BIGINT          NOT NULL AUTO_INCREMENT,
    store_id         BIGINT          NOT NULL,
    category_id      BIGINT,
    name             VARCHAR(150)    NOT NULL,
    description      TEXT,
    barcode          VARCHAR(50),
    sku              VARCHAR(50),
    -- Unit structure: selling_price / cost_price are per BASE unit (smallest unit)
    -- unitsPerPack and packsPerCarton are conversion multipliers for receiving / display
    base_unit        ENUM('UNIT','PACK','CARTON') NOT NULL DEFAULT 'UNIT',
    units_per_pack   INT             NOT NULL DEFAULT 1,
    packs_per_carton INT             NOT NULL DEFAULT 1,
    cost_price       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    selling_price    DECIMAL(10,2)   NOT NULL,
    low_stock_threshold INT          NOT NULL DEFAULT 10,
    is_active        BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    created_by  BIGINT,
    updated_by  BIGINT,
    PRIMARY KEY (id),
    UNIQUE  KEY uk_products_store_barcode (store_id, barcode),
    UNIQUE  KEY uk_products_store_sku     (store_id, sku),
    KEY         idx_products_store        (store_id),
    KEY         idx_products_category     (category_id),
    CONSTRAINT fk_products_store    FOREIGN KEY (store_id)    REFERENCES stores     (id),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per product per store — the live stock level (in base units)
CREATE TABLE stock_balances (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    store_id    BIGINT          NOT NULL,
    product_id  BIGINT          NOT NULL,
    quantity    DECIMAL(10,3)   NOT NULL DEFAULT 0.000,
    updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE  KEY uk_stock_balances_store_product (store_id, product_id),
    CONSTRAINT fk_stock_balances_store   FOREIGN KEY (store_id)   REFERENCES stores   (id),
    CONSTRAINT fk_stock_balances_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Immutable audit trail of every stock change
CREATE TABLE stock_movements (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    store_id        BIGINT          NOT NULL,
    product_id      BIGINT          NOT NULL,
    movement_type   ENUM('RECEIVE','SALE','ADJUSTMENT','RETURN','VOID') NOT NULL,
    quantity        DECIMAL(10,3)   NOT NULL,   -- positive = in, negative = out
    quantity_before DECIMAL(10,3)   NOT NULL,
    quantity_after  DECIMAL(10,3)   NOT NULL,
    reference_id    BIGINT,                     -- FK to sale / refund (nullable)
    note            VARCHAR(255),
    created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by  BIGINT,
    PRIMARY KEY (id),
    KEY idx_stock_movements_store_product (store_id, product_id),
    KEY idx_stock_movements_type          (movement_type),
    CONSTRAINT fk_stock_movements_store   FOREIGN KEY (store_id)   REFERENCES stores   (id),
    CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
