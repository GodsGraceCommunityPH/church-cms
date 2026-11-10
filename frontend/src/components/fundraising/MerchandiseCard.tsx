import { Shirt, ShoppingBag, Sticker } from "lucide-react";
import type { ShopItem } from "../../features/fundraising/projectIlaw";
import { SHOP_STATUS } from "../../features/fundraising/projectIlaw";

const ART_ICONS = {
  tee: Shirt,
  tote: ShoppingBag,
  stickers: Sticker,
} as const;

interface MerchandiseCardProps {
  item: ShopItem;
}

export default function MerchandiseCard({ item }: MerchandiseCardProps) {
  const ArtIcon = ART_ICONS[item.art];

  return (
    <article className="merch-card">
      <div className="merch-art" aria-hidden="true">
        <span className="merch-badge">Placeholder</span>
        <ArtIcon className="merch-art-icon" size={72} strokeWidth={1.35} />
        <span className="merch-art-caption">Artwork preview pending</span>
      </div>
      <div className="merch-body">
        <p className="merch-category">{item.category}</p>
        <h3>{item.name}</h3>
        <p className="merch-description">{item.description}</p>
        <div className="merch-meta">
          <span className="merch-price">{SHOP_STATUS.priceLabel}</span>
          <span className="merch-availability">{SHOP_STATUS.availabilityLabel}</span>
        </div>
      </div>
    </article>
  );
}
