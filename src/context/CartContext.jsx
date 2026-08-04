import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // `variant` (opcional): { id, name, price, default_weight_kg }
  const isWeightUnit = (unit) => unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(unit);

  const addItem = (product, qty = 1, variant = null) => {
    const isWeightProduct = isWeightUnit(product.unit);
    const unitWeight = variant?.default_weight_kg ?? product.default_weight_kg ?? null;
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id && (i.variant_id || null) === (variant?.id || null));
      if (existing) {
        const nextQty = existing.quantity + qty;
        return prev.map(i => (i === existing)
          ? {
            ...i,
            quantity: nextQty,
            weight_kg: isWeightProduct
              ? (unitWeight != null ? nextQty * unitWeight : nextQty)
              : i.weight_kg,
          }
          : i);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        variant_id: variant?.id || null,
        variant_name: variant?.name || null,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        price: variant ? variant.price : product.price,
        quantity: qty,
        weight_kg: isWeightProduct
          ? (unitWeight != null ? qty * unitWeight : qty)
          : null,
        weight_per_unit_kg: unitWeight,
        unit: product.unit,
        stock_quantity: product.stock_quantity,
        image_url: product.image_url,
        barcode: product.barcode
      }];
    });
  };

  const removeItem = (productId, variantId = null) =>
    setItems(prev => prev.filter(i => !(i.product_id === productId && (i.variant_id || null) === (variantId || null))));

  const updateQuantity = (productId, qty, variantId = null) => {
    if (qty <= 0) return removeItem(productId, variantId);
    setItems(prev => prev.map(i => {
      if (i.product_id !== productId || (i.variant_id || null) !== (variantId || null)) return i;
      const isWeightProduct = isWeightUnit(i.unit);
      return {
        ...i,
        quantity: qty,
        weight_kg: isWeightProduct
          ? (i.weight_per_unit_kg != null ? qty * i.weight_per_unit_kg : qty)
          : i.weight_kg,
      };
    }));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((s, i) => {
    const effectiveQty = (i.weight_per_unit_kg != null && i.weight_per_unit_kg !== '')
      ? Number(i.quantity || 0) * Number(i.weight_per_unit_kg)
      : Number(i.quantity || 0);
    return s + (i.price || 0) * effectiveQty;
  }, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
};
