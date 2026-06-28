-- Stores individual payment legs when a sale uses multiple payment methods
CREATE TABLE sale_payments (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id        BIGINT         NOT NULL,
    payment_method VARCHAR(20)    NOT NULL,
    amount         DECIMAL(12,2)  NOT NULL,
    CONSTRAINT fk_sp_sale FOREIGN KEY (sale_id) REFERENCES sales(id)
) ENGINE = InnoDB;

-- Allow 'MIXED' as a payment_method value on the sales table
-- (no DDL change needed; the column is VARCHAR and the enum is enforced by Java)
