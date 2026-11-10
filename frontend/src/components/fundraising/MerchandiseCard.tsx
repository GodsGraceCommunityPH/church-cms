import type { ShopItem } from "../../features/fundraising/projectIlaw";
import {
  formatPeso,
  SHOP_STATUS,
} from "../../features/fundraising/projectIlaw";

interface MerchandiseCardProps {
  item: ShopItem;
}

export default function MerchandiseCard({ item }: MerchandiseCardProps) {
  return (
    <article className="merch-card">
      <div className="merch-art">
        <img
          src={item.image.src}
          alt={item.image.alt}
          width={item.image.width}
          height={item.image.height}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="merch-body">
        <p className="merch-category">{item.category}</p>
        <h3>{item.name}</h3>
        <p className="merch-price">{formatPeso(item.price)}</p>
        <p className="merch-description">{item.description}</p>
        <div className="merch-spec">
          <span className="merch-spec-label">{item.sizeLabel}</span>
          <ul className="merch-chips" aria-label={`${item.name} sizes`}>
            {item.sizes.map((size) => (
              <li key={size}>{size}</li>
            ))}
          </ul>
        </div>
        <div className="merch-spec">
          <span className="merch-spec-label">{item.colorLabel}</span>
          <ul className="merch-chips" aria-label={`${item.name} colours`}>
            {item.colors.map((color) => (
              <li key={color}>{color}</li>
            ))}
          </ul>
        </div>
        <div className="merch-meta">
          <span className="merch-availability">
            {SHOP_STATUS.availabilityLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
