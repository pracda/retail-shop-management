-- Allow manual (non-product) line items on a sale
ALTER TABLE sale_items
    MODIFY COLUMN product_id BIGINT NULL,
    ADD COLUMN manual_description VARCHAR(255) NULL AFTER product_id;
