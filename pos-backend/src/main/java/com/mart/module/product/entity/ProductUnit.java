package com.mart.module.product.entity;

/**
 * The unit hierarchy for a product.
 * All prices and stock quantities are expressed in the BASE unit (smallest unit = UNIT).
 * unitsPerPack and packsPerCarton are used for receiving and display conversions.
 */
public enum ProductUnit {
    UNIT,
    PACK,
    CARTON
}
