import { useState } from "react";
import type { ShopItem } from "../../features/fundraising/projectIlaw";
import { formatPeso, SHOP_STATUS } from "../../features/fundraising/projectIlaw";

interface MerchandiseCardProps {
  item: ShopItem;
  ordersEnabled?: boolean;
}

const COLOR_CLASS: Record<string, string> = {
  Black: "black",
  White: "white",
  Maroon: "maroon",
  Green: "green",
  Blue: "blue",
};

export default function MerchandiseCard({ item, ordersEnabled = false }: MerchandiseCardProps) {
  const isShirt = item.id === "project-ilaw-t-shirt";
  const [selectedColor, setSelectedColor] = useState(item.colors[0] ?? "Black");
  const [galleryOpen, setGalleryOpen] = useState(false);

  const preview = (color: string, large = false) => (
    <span
      aria-hidden="true"
      className={`merch-shirt-preview merch-shirt-preview-${COLOR_CLASS[color] ?? "black"}${large ? " merch-shirt-preview-large" : ""}`}
      style={{ backgroundImage: `url("${item.image.src}")` }}
    />
  );

  return (
    <article className="merch-card">
      {isShirt ? (
        <div className="merch-shirt-gallery" aria-label="Project Ilaw T-shirt colours">
          {item.colors.map((color) => (
            <button
              className="merch-shirt-thumbnail"
              key={color}
              type="button"
              onClick={() => { setSelectedColor(color); setGalleryOpen(true); }}
              aria-label={`View ${color} Project Ilaw T-shirt`}
            >
              {preview(color)}
              <span>{color}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="merch-art">
          <img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
        </div>
      )}
      <div className="merch-body">
        <p className="merch-category">{item.category}</p>
        <h3>{item.name}</h3>
        <p className="merch-price">{formatPeso(item.price)}</p>
        <p className="merch-description">{item.description}</p>
        <div className="merch-spec">
          <span className="merch-spec-label">{item.sizeLabel}</span>
          <ul className="merch-chips" aria-label={`${item.name} sizes`}>
            {item.sizes.map((size) => <li key={size}>{size}</li>)}
          </ul>
        </div>
        <div className="merch-spec">
          <span className="merch-spec-label">{item.colorLabel}</span>
          <ul className="merch-chips" aria-label={`${item.name} colours`}>
            {item.colors.map((color) => <li key={color}>{color}</li>)}
          </ul>
        </div>
        <div className="merch-meta">
          <span className={`merch-availability${ordersEnabled ? "" : " merch-availability-closed"}`}>
            {ordersEnabled ? SHOP_STATUS.availabilityLabel : SHOP_STATUS.closedLabel}
          </span>
        </div>
      </div>
      {isShirt && galleryOpen && (
        <div className="merch-gallery-backdrop" onClick={() => setGalleryOpen(false)}>
          <section
            className="merch-gallery-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Project Ilaw ${selectedColor} T-shirt preview`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="merch-gallery-heading">
              <div><p className="merch-category">Project Ilaw T-shirt</p><h3>{selectedColor}</h3></div>
              <button className="merch-gallery-close" type="button" onClick={() => setGalleryOpen(false)} aria-label="Close preview">×</button>
            </div>
            {preview(selectedColor, true)}
            <div className="merch-gallery-colors" aria-label="Choose shirt colour">
              {item.colors.map((color) => (
                <button
                  className={`merch-gallery-color${selectedColor === color ? " is-selected" : ""}`}
                  key={color}
                  type="button"
                  aria-pressed={selectedColor === color}
                  onClick={() => setSelectedColor(color)}
                >
                  {preview(color)}<span>{color}</span>
                </button>
              ))}
            </div>
            <p className="merch-gallery-note">Front and back design shown. Available sizes: XS–3XL.</p>
          </section>
        </div>
      )}
    </article>
  );
}
