CREATE TABLE customers (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id       BIGINT         NOT NULL,
    name           VARCHAR(200)   NOT NULL,
    phone          VARCHAR(50)    NULL,
    email          VARCHAR(200)   NULL,
    address        TEXT           NULL,
    loyalty_points INT            NOT NULL DEFAULT 0,
    total_spent    DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
    notes          TEXT           NULL,
    is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at     DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_customer_store FOREIGN KEY (store_id) REFERENCES stores(id)
) ENGINE = InnoDB;

ALTER TABLE sales
    ADD COLUMN customer_id BIGINT NULL,
    ADD CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
