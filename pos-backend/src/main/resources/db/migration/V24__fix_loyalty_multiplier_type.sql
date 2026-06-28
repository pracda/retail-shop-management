-- Fix: Hibernate expects INTEGER but column was created as TINYINT UNSIGNED in V21.
-- Alter to INT to match the Java entity mapping.
ALTER TABLE products
    MODIFY COLUMN loyalty_multiplier INT NOT NULL DEFAULT 1
        COMMENT '1 = earn 1x points, 2 = earn 2x, etc. Default 1.';
