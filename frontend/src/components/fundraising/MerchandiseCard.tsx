import { useEffect, useState } from "react";
import { T_SHIRT_SIZES, type OrderDraftItem } from "../../features/fundraising/projectIlaw";
import type { ShopItem } from "../../features/fundraising/projectIlaw";
import { formatPeso, SHOP_STATUS } from "../../features/fundraising/projectIlaw";

interface MerchandiseCardProps {
  item: ShopItem;
  ordersEnabled?: boolean;
  onAddItem: (item: OrderDraftItem) => void;
  disabled?: boolean;
}

export default function MerchandiseCard({ item, ordersEnabled = false, onAddItem, disabled = false }: MerchandiseCardProps) {
  const isShirt = item.id === "project-ilaw-t-shirt";
  const [selectedColor, setSelectedColor] = useState(item.colors[0] ?? "Black");
  const [selectedSize, setSelectedSize] = useState(isShirt ? "" : "One Size");
  const [quantity, setQuantity] = useState("1");
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (!imageOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageOpen]);

  return (
    <article className="merch-card">
      <div className="merch-art">
        <button
          className="merch-image-trigger"
          type="button"
          onClick={() => setImageOpen(true)}
          aria-label={`Enlarge ${item.name} image`}
          aria-haspopup="dialog"
        >
          <img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
          <span className="merch-image-hint">Tap to enlarge</span>
        </button>
      </div>
      <div className="merch-body">
        <p className="merch-category">{item.category}</p>
        <h3>{item.name}</h3>
        <p className="merch-price">{formatPeso(item.price)}</p>
        <p className="merch-description">{item.description}</p>
        <div className="merch-order-controls">
          {isShirt && (
            <div className="order-field">
              <label htmlFor={`merch-size-${item.id}`}>Choose size</label>
              <select id={`merch-size-${item.id}`} value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)} disabled={disabled || !ordersEnabled}>
                <option value="">Select size</option>
                {T_SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          )}
          <div className="order-field">
            <label htmlFor={`merch-color-${item.id}`}>{item.colorLabel}</label>
            <select id={`merch-color-${item.id}`} value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} disabled={disabled || !ordersEnabled}>
              {item.colors.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
          </div>
          <div className="order-field">
            <label htmlFor={`merch-quantity-${item.id}`}>Quantity</label>
            <input id={`merch-quantity-${item.id}`} type="number" min="1" max="99" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={disabled || !ordersEnabled} />
          </div>
          <button
            className="ilaw-primary merch-add-button"
            type="button"
            disabled={disabled || !ordersEnabled || (isShirt && !selectedSize) || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 99}
            onClick={() => {
              onAddItem({
                key: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                productId: item.id,
                size: isShirt ? selectedSize : "One Size",
                color: selectedColor,
                quantity: Number(quantity),
              });
              setQuantity("1");
            }}
          >
            Add to order · {formatPeso(item.price * (Number(quantity) || 0))}
          </button>
        </div>
        <div className="merch-meta">
          <span className={`merch-availability${ordersEnabled ? "" : " merch-availability-closed"}`}>
            {ordersEnabled ? SHOP_STATUS.availabilityLabel : SHOP_STATUS.closedLabel}
          </span>
        </div>
      </div>

      {imageOpen && (
        <div
          className="merch-image-lightbox"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setImageOpen(false);
          }}
        >
          <div className="merch-image-dialog" role="dialog" aria-modal="true" aria-label={`${item.name} enlarged image`}>
            <button className="merch-image-close" type="button" onClick={() => setImageOpen(false)} aria-label="Close enlarged image" autoFocus>×</button>
            <img src={item.image.src} alt={item.image.alt} />
            <p>{item.name} · {selectedColor}</p>
          </div>
        </div>
      )}
    </article>
  );
}
