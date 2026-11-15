import {
  calculateDraftTotals,
  createDraftItem,
  formatPeso,
  getShopItem,
  SHOP_ITEMS,
  type OrderDraftItem,
} from "../../features/fundraising/projectIlaw";

interface OrderLineItemsEditorProps {
  items: OrderDraftItem[];
  onChange: (items: OrderDraftItem[]) => void;
  disabled?: boolean;
  /** Locks product identity and line count while allowing quantity, colour, and applicable size edits. */
  restricted?: boolean;
  idPrefix: string;
}

export default function OrderLineItemsEditor({
  items,
  onChange,
  disabled = false,
  restricted = false,
  idPrefix,
}: OrderLineItemsEditorProps) {
  const totals = calculateDraftTotals(items);

  function updateItem(key: string, changes: Partial<OrderDraftItem>) {
    onChange(items.map((item) => item.key === key ? { ...item, ...changes } : item));
  }

  return (
    <section className="order-line-items" aria-labelledby={`${idPrefix}-items-title`}>
      <div className="order-line-item-heading">
        <h3 id={`${idPrefix}-items-title`}>Order items</h3>
        {!restricted && (
          <button
            type="button"
            className="order-line-remove"
            disabled={disabled || items.length >= 20}
            onClick={() => onChange([...items, createDraftItem()])}
          >
            Add item
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="order-cart-empty">Add at least one product to this order.</p>
      ) : (
        <div className="order-line-items-list">
          {items.map((item, index) => {
            const product = getShopItem(item.productId);
            const quantity = Number(item.quantity);
            const validQuantity = Number.isInteger(quantity) && quantity > 0 && quantity <= 99;
            return (
              <div className="order-line-item order-cart-item" key={item.key}>
                <div className="order-line-item-heading">
                  <span>Item {index + 1}</span>
                  {!restricted && (
                    <button
                      type="button"
                      className="order-line-remove"
                      onClick={() => onChange(items.filter((line) => line.key !== item.key))}
                      disabled={disabled || items.length <= 1}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="order-cart-item-details">
                  {!restricted && (
                    <label>
                      Product
                      <select
                        value={item.productId}
                        disabled={disabled}
                        onChange={(event) => {
                          const next = getShopItem(event.target.value);
                          if (!next) return;
                          updateItem(item.key, {
                            productId: next.id,
                            size: next.sizes.length === 1 ? next.sizes[0] : "",
                            color: "",
                          });
                        }}
                      >
                        {SHOP_ITEMS.map((shopItem) => (
                          <option key={shopItem.id} value={shopItem.id}>
                            {shopItem.name} · {formatPeso(shopItem.price)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {product && product.sizes.length > 1 && (
                    <label>
                      Size
                      <select
                        value={item.size}
                        disabled={disabled}
                        onChange={(event) => updateItem(item.key, { size: event.target.value })}
                      >
                        <option value="">Choose size</option>
                        {product.sizes.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                  )}
                  {product && (
                    <label>
                      {product.colorLabel}
                      <select
                        value={item.color}
                        disabled={disabled}
                        onChange={(event) => updateItem(item.key, { color: event.target.value })}
                      >
                        <option value="">Choose colour</option>
                        {product.colors.map((color) => <option key={color} value={color}>{color}</option>)}
                      </select>
                    </label>
                  )}
                  <span>{formatPeso(product?.price ?? 0)} each</span>
                </div>
                <div className="order-cart-item-footer">
                  <label htmlFor={`${idPrefix}-quantity-${item.key}`}>Quantity</label>
                  <input
                    id={`${idPrefix}-quantity-${item.key}`}
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={item.quantity}
                    disabled={disabled}
                    onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                  />
                  <strong>{validQuantity ? formatPeso((product?.price ?? 0) * quantity) : "Check quantity"}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="order-summary-totals">
        <div><span>Total quantity</span><strong>{totals.totalQuantity}</strong></div>
        <div><span>Order total</span><strong>{formatPeso(totals.totalAmount)}</strong></div>
      </div>
    </section>
  );
}
