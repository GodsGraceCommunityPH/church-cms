import {
  calculateDraftTotals,
  formatPeso,
  getShopItem,
  type OrderDraftItem,
} from "../../features/fundraising/projectIlaw";

interface OrderLineItemsEditorProps {
  items: OrderDraftItem[];
  onChange: (items: OrderDraftItem[]) => void;
  disabled?: boolean;
  idPrefix: string;
}

export default function OrderLineItemsEditor({ items, onChange, disabled = false }: OrderLineItemsEditorProps) {
  const totals = calculateDraftTotals(items);
  return (
    <section className="order-line-items" aria-labelledby="order-items-title">
      <h3 id="order-items-title">Your order</h3>
      {items.length === 0 ? (
        <p className="order-cart-empty">Choose a product above and add it to your order.</p>
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
                  <button type="button" className="order-line-remove" onClick={() => onChange(items.filter((line) => line.key !== item.key))} disabled={disabled}>Remove</button>
                </div>
                <div className="order-cart-item-details">
                  <strong>{product?.name ?? "Unknown product"}</strong>
                  <span>{item.color}{item.size && item.size !== "One Size" ? ` · ${item.size}` : ""}</span>
                  <span>{formatPeso(product?.price ?? 0)} each</span>
                </div>
                <div className="order-cart-item-footer">
                  <label htmlFor={`cart-quantity-${item.key}`}>Quantity</label>
                  <input id={`cart-quantity-${item.key}`} type="number" min="1" max="99" step="1" value={item.quantity} disabled={disabled} onChange={(event) => onChange(items.map((line) => line.key === item.key ? { ...line, quantity: event.target.value } : line))} />
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
