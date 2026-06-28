-- ── Ecommerce: Carts & Orders ─────────────────────────────────────────────────

CREATE TABLE online_carts (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    store_id    BIGINT NOT NULL,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_cart_customer_store (customer_id, store_id),
    CONSTRAINT fk_cart_customer FOREIGN KEY (customer_id)
        REFERENCES online_customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_store FOREIGN KEY (store_id) REFERENCES stores(id)
) ENGINE=InnoDB;

CREATE TABLE online_cart_items (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    cart_id    BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_cart_item (cart_id, product_id),
    CONSTRAINT fk_ci_cart    FOREIGN KEY (cart_id)    REFERENCES online_carts(id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE online_orders (
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number         VARCHAR(30) NOT NULL,
    customer_id          BIGINT NOT NULL,
    store_id             BIGINT NOT NULL,
    status               VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    subtotal             DECIMAL(14,2) NOT NULL,
    discount_amount      DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total_amount         DECIMAL(14,2) NOT NULL,
    loyalty_points_used  INT NOT NULL DEFAULT 0,
    loyalty_points_earned INT NOT NULL DEFAULT 0,
    delivery_address     TEXT,
    note                 TEXT,
    placed_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    confirmed_at         DATETIME(6),
    fulfilled_at         DATETIME(6),
    cancelled_at         DATETIME(6),
    cancel_reason        TEXT,
    UNIQUE KEY uq_order_number (order_number),
    KEY idx_oo_customer (customer_id),
    KEY idx_oo_store_status (store_id, status),
    CONSTRAINT fk_oo_customer FOREIGN KEY (customer_id) REFERENCES online_customers(id),
    CONSTRAINT fk_oo_store    FOREIGN KEY (store_id)    REFERENCES stores(id)
) ENGINE=InnoDB;

CREATE TABLE online_order_items (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id     BIGINT NOT NULL,
    product_id   BIGINT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit_price   DECIMAL(14,2) NOT NULL,
    quantity     INT NOT NULL,
    line_total   DECIMAL(14,2) NOT NULL,
    CONSTRAINT fk_ooi_order   FOREIGN KEY (order_id)   REFERENCES online_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_ooi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;
