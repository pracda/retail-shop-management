-- ============================================================
-- V6: Sales schema
-- ============================================================

CREATE TABLE sales (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    store_id        BIGINT          NOT NULL,
    shift_id        BIGINT          NOT NULL,
    cashier_id      BIGINT          NOT NULL,
    receipt_number  VARCHAR(30)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'COMPLETED',
    subtotal        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    tax_amount      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    amount_tendered DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    change_due      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    payment_method  VARCHAR(20)     NOT NULL DEFAULT 'CASH',
    notes           TEXT,
    voided_by       BIGINT,
    voided_at       DATETIME(6),
    void_reason     TEXT,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_sales_receipt_number (receipt_number),
    CONSTRAINT fk_sales_store    FOREIGN KEY (store_id)   REFERENCES stores  (id),
    CONSTRAINT fk_sales_shift    FOREIGN KEY (shift_id)   REFERENCES shifts  (id),
    CONSTRAINT fk_sales_cashier  FOREIGN KEY (cashier_id) REFERENCES users   (id),
    CONSTRAINT fk_sales_voided_by FOREIGN KEY (voided_by) REFERENCES users   (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sale_items (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    sale_id         BIGINT          NOT NULL,
    product_id      BIGINT          NOT NULL,
    quantity        DECIMAL(10,3)   NOT NULL,
    unit_price      DECIMAL(10,2)   NOT NULL,
    discount_amount DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    line_total      DECIMAL(12,2)   NOT NULL,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_sale_items_sale    FOREIGN KEY (sale_id)    REFERENCES sales    (id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sales_store    ON sales(store_id);
CREATE INDEX idx_sales_shift    ON sales(shift_id);
CREATE INDEX idx_sales_cashier  ON sales(cashier_id);
CREATE INDEX idx_sales_created  ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_prod ON sale_items(product_id);
