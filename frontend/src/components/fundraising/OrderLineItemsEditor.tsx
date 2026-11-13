import {
  T_SHIRT_SIZES,
  calculateDraftTotals,
  createDraftItem,
  defaultColorForProduct,
  defaultSizeForProduct,
  formatPeso,
  getShopItem,
  isEcoBag,
  type OrderDraftItem,
} from "../../features/fundraising/projectIlaw";

interface OrderLineItemsEditorProps {
  items: OrderDraftItem[];
  onChange: (items: OrderDraftItem[]) => void;
  disabled?: boolean;
  idPrefix: string;
}

export default function OrderLineItemsEditor({
  items,
  onChange,
  disabled = false,
  idPrefix,
}: OrderLineItemsEditorProps) {
  const updateItem = (key: string, patch: Partial<OrderDraftItem>) => {
    onChange(
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (key: string) => {
    if (items.length <= 1) return;
    onChange(items.filter((item) => item.key !== key));
  };

  const addItem = () => {
    onChange([...items, createDraftItem()]);
  };

  const totals = calculateDraftTotals(items);

  return (
    <fieldset className="order-line-items" disabled={disabled}>
      <legend>Order items</legend>

      <div className="order-line-items-list">
        {items.map((item, index) => {
          const product = getShopItem(item.productId);
          const quantity = Number(item.quantity);
          const lineTotal =
            product && Number.isInteger(quantity) && quantity > 0
              ? product.price * quantity
              : 0;

          return (
            <div className="order-line-item" key={item.key}>
              <div className="order-line-item-heading">
                <span>Item {index + 1}</span>
                <button
                  type="button"
                  className="order-line-remove"
                  onClick={() => removeItem(item.key)}
                  disabled={disabled || items.length <= 1}
                >
                  Remove
                </button>
              </div>

              <div className="order-line-grid">
                <div className="order-field">
                  <label htmlFor={`${idPrefix}-product-${item.key}`}>
                    Product
                  </label>
                  <select
                    id={`${idPrefix}-product-${item.key}`}
                    value={item.productId}
                    onChange={(event) => {
                      const productId = event.target.value;
                      updateItem(item.key, {
                        productId,
                        size: defaultSizeForProduct(productId),
                        color: defaultColorForProduct(productId),
                      });
                    }}
                  >
                    <option value="">Select a product</option>
                    <option value="project-ilaw-t-shirt">
                      Project Ilaw T-shirt
                    </option>
                    <option value="project-ilaw-eco-bag">
                      Project Ilaw Eco Bag
                    </option>
                  </select>
                </div>

                {product ? (
                  <div className="order-field">
                    <label htmlFor={`${idPrefix}-color-${item.key}`}>
                      {product.colorLabel}
                    </label>
                    <select
                      id={`${idPrefix}-color-${item.key}`}
                      value={item.color}
                      onChange={(event) =>
                        updateItem(item.key, { color: event.target.value })
                      }
                    >
                      <option value="">Select a colour</option>
                      {product.colors.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div
                    className="order-field order-size-placeholder"
                    aria-hidden="true"
                  />
                )}

                {isEcoBag(item.productId) ? (
                  <div
                    className="order-field order-size-placeholder"
                    aria-hidden="true"
                  />
                ) : (
                  <div className="order-field">
                    <label htmlFor={`${idPrefix}-size-${item.key}`}>
                      Size
                    </label>
                    <select
                      id={`${idPrefix}-size-${item.key}`}
                      value={item.size}
                      onChange={(event) =>
                        updateItem(item.key, { size: event.target.value })
                      }
                    >
                      <option value="">Select a size</option>
                      {T_SHIRT_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="order-field order-quantity-field">
                  <label htmlFor={`${idPrefix}-quantity-${item.key}`}>
                    Quantity
                  </label>
                  <input
                    id={`${idPrefix}-quantity-${item.key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    step={1}
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.key, { quantity: event.target.value })
                    }
                  />
                </div>

                <div className="order-line-price">
                  <span>Unit price</span>
                  <strong>{formatPeso(product?.price ?? 499)}</strong>
                  <span>Line total</span>
                  <strong>{formatPeso(lineTotal)}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="order-line-items-footer">
        <button
          type="button"
          className="order-add-item"
          onClick={addItem}
          disabled={disabled || items.length >= 20}
        >
          + Add another item
        </button>
        <span>
          {totals.totalQuantity} total item
          {totals.totalQuantity === 1 ? "" : "s"}
        </span>
      </div>
    </fieldset>
  );
}
