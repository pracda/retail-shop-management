CREATE TABLE promotions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id        BIGINT         NOT NULL,
    name            VARCHAR(200)   NOT NULL,
    description     TEXT           NULL,
    promo_type      VARCHAR(30)    NOT NULL,
        -- PERCENTAGE_OFF | FIXED_OFF | BUY_X_GET_Y
    discount_value  DECIMAL(10,4)  NOT NULL  COMMENT 'Fraction for PERCENTAGE_OFF (0.1=10%), absolute for FIXED_OFF',
    min_purchase    DECIMAL(10,2)  NULL      COMMENT 'Minimum cart total to activate',
    max_discount    DECIMAL(10,2)  NULL      COMMENT 'Cap on discount amount',
    applies_to      VARCHAR(20)    NOT NULL DEFAULT 'ORDER',
        -- ORDER | CATEGORY | PRODUCT
    target_id       BIGINT         NULL      COMMENT 'category_id or product_id when applies_to != ORDER',
    buy_quantity    INT            NULL      COMMENT 'BUY_X_GET_Y: X',
    get_quantity    INT            NULL      COMMENT 'BUY_X_GET_Y: Y',
    starts_at       DATETIME(6)    NOT NULL,
    ends_at         DATETIME(6)    NULL,
    is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_promo_store FOREIGN KEY (store_id) REFERENCES stores(id)
) ENGINE = InnoDB;
