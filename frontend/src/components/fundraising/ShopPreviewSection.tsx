import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import MerchandiseCard from "./MerchandiseCard";
import {
  SHOP_ITEMS,
  SHOP_PREVIEW,
  SHOP_STATUS,
} from "../../features/fundraising/projectIlaw";
import "../../features/fundraising/Fundraising.css";

export default function ShopPreviewSection() {
  return (
    <section
      className="shop-preview-section"
      id="shop-preview"
      aria-labelledby="shop-preview-title"
    >
      <div className="shop-preview-inner">
        <div className="shop-preview-heading">
          <div>
            <p className="ilaw-eyebrow">Support Project Ilaw</p>
            <h2 id="shop-preview-title">{SHOP_PREVIEW.title}</h2>
            <p className="shop-preview-description">{SHOP_PREVIEW.description}</p>
          </div>
          <Link className="ilaw-primary" to="/shop">
            {SHOP_PREVIEW.cta}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="merch-grid">
          {SHOP_ITEMS.map((item) => (
            <MerchandiseCard item={item} key={item.id} />
          ))}
        </div>
        <p className="shop-preview-note">{SHOP_STATUS.catalogNotice}</p>
      </div>
    </section>
  );
}
