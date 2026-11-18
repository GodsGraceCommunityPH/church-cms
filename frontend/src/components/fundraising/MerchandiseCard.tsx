import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Ruler } from "lucide-react";
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
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const selectedImage = item.imageVariants[selectedColor] ?? item.image;
  const colorIndex = Math.max(0, item.colors.indexOf(selectedColor));
  const canPrevColor = colorIndex > 0;
  const canNextColor = colorIndex < item.colors.length - 1;

  function goPrevColor() {
    if (!canPrevColor) return;
    setSelectedColor(item.colors[colorIndex - 1]);
  }

  function goNextColor() {
    if (!canNextColor) return;
    setSelectedColor(item.colors[colorIndex + 1]);
  }

  useEffect(() => {
    if (!imageOpen && !sizeChartOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImageOpen(false);
        setSizeChartOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageOpen, sizeChartOpen]);

  return (
    <article className="merch-card">
      <div className="merch-art">
        <button
          className="merch-image-trigger"
          type="button"
          onClick={() => setImageOpen(true)}
          aria-label={`Enlarge ${item.name} in ${selectedColor}`}
          aria-haspopup="dialog"
        >
          <img src={selectedImage.src} alt={selectedImage.alt} width={selectedImage.width} height={selectedImage.height} loading="lazy" decoding="async" />
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
              <div className="merch-size-field-heading">
                <label htmlFor={`merch-size-${item.id}`}>Choose size</label>
                <button
                  className="merch-size-chart-button"
                  type="button"
                  onClick={() => setSizeChartOpen(true)}
                  aria-haspopup="dialog"
                  aria-label="View T-shirt size chart"
                >
                  <Ruler size={14} aria-hidden="true" />
                  <span>Size chart</span>
                </button>
              </div>
              <select id={`merch-size-${item.id}`} value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)} disabled={disabled || !ordersEnabled}>
                <option value="">Select size</option>
                {T_SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          )}
          <div className="order-field merch-color-field">
            <label id={`merch-color-label-${item.id}`}>{item.colorLabel}</label>
            <div className="merch-color-picker" role="group" aria-labelledby={`merch-color-label-${item.id}`}>
              <button
                type="button"
                className="merch-color-arrow"
                onClick={goPrevColor}
                disabled={disabled || !ordersEnabled || !canPrevColor}
                aria-label={`Previous ${item.colorLabel.toLowerCase()}`}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="merch-color-value" aria-live="polite">{selectedColor}</span>
              <button
                type="button"
                className="merch-color-arrow"
                onClick={goNextColor}
                disabled={disabled || !ordersEnabled || !canNextColor}
                aria-label={`Next ${item.colorLabel.toLowerCase()}`}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
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
            <img src={selectedImage.src} alt={selectedImage.alt} width={selectedImage.width} height={selectedImage.height} />
            <p>{item.name} · {selectedColor}</p>
          </div>
        </div>
      )}

      {sizeChartOpen && isShirt && (
        <div
          className="merch-image-lightbox"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSizeChartOpen(false);
          }}
        >
          <div
            className="merch-image-dialog merch-size-chart-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merch-size-chart-title"
          >
            <button
              className="merch-image-close"
              type="button"
              onClick={() => setSizeChartOpen(false)}
              aria-label="Close size chart"
              autoFocus
            >
              ×
            </button>
            <h3 id="merch-size-chart-title">T-shirt size chart</h3>
            <p className="merch-size-chart-intro">
              Measurements are in inches. Lay a shirt flat to measure: width
              is across the chest, and height is from the shoulder to the hem.
            </p>
            <div className="merch-size-chart-content">
              <svg
                className="merch-size-chart-shirt"
                viewBox="0 0 320 360"
                role="img"
                aria-label="T-shirt measurement diagram showing width across the chest and height from shoulder to hem"
              >
                <defs>
                  <marker
                    id="merch-size-chart-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="5"
                    refY="3.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M0 0 L7 3.5 L0 7 Z" fill="#dc2626" />
                  </marker>
                </defs>
                <path
                  d="M104 29 L133 15 Q160 7 187 15 L216 29 L284 77 L258 139 L222 119 L222 331 Q160 345 98 331 L98 119 L62 139 L36 77 Z"
                  fill="#fff"
                  stroke="#9aa3af"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <path
                  d="M130 18 Q135 57 160 57 Q185 57 190 18"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="5"
                />
                <line
                  x1="101"
                  y1="178"
                  x2="219"
                  y2="178"
                  stroke="#dc2626"
                  strokeWidth="4"
                  markerStart="url(#merch-size-chart-arrow)"
                  markerEnd="url(#merch-size-chart-arrow)"
                />
                <text x="160" y="160" textAnchor="middle" className="merch-size-chart-svg-label">
                  Width
                </text>
                <line
                  x1="244"
                  y1="30"
                  x2="244"
                  y2="329"
                  stroke="#dc2626"
                  strokeWidth="4"
                  markerStart="url(#merch-size-chart-arrow)"
                  markerEnd="url(#merch-size-chart-arrow)"
                />
                <text x="234" y="190" textAnchor="end" className="merch-size-chart-svg-label">
                  Height
                </text>
              </svg>
              <div className="merch-size-chart-table-wrap">
                <table className="merch-size-chart-table">
                  <thead>
                    <tr>
                      <th scope="col">Size</th>
                      <th scope="col">Width</th>
                      <th scope="col">Height</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["XS", "17″", "24″"],
                      ["S", "18″", "25″"],
                      ["M", "19″", "26″"],
                      ["L", "20″", "27″"],
                      ["XL", "21″", "28″"],
                      ["2XL", "22″", "29″"],
                      ["3XL", "23″", "30″"],
                      ["5XL", "25″", "32″"],
                    ].map(([size, width, height]) => (
                      <tr key={size}>
                        <th scope="row">{size}</th>
                        <td>{width}</td>
                        <td>{height}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="merch-size-chart-note">
              5XL appears in the reference chart but is not currently available
              in the size selector.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
