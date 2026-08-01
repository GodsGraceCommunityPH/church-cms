import { useState } from "react";
import { Check, Copy, HandCoins, Heart, Landmark, Wallet } from "lucide-react";
import instapayQr from "../assets/instapay-qr.png";
import PublicPage from "../components/PublicPage";

const accountName = "Gods Grace Community Church";
const accountNumber = "3143314461925";

export default function GivePage() {
  const [copiedField, setCopiedField] = useState("");
  async function copyValue(field: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(""), 2000);
  }

  return (
    <PublicPage eyebrow="Give" title="Giving is an act of worship" description="Your generosity helps GGCCC share the Gospel, serve our community, and support the work of its ministries.">
      <section className="public-section giving-intro-grid">
        <article className="public-card giving-copy"><h2>Giving with a cheerful heart</h2><p>Through your generosity, we are able to continue sharing the Gospel, serving our community, and supporting the ministries of God's Grace Community Covenant Church.</p></article>
        <aside className="public-card scripture-card" aria-label="2 Corinthians 9 verse 7"><Heart size={32} aria-hidden="true" /><blockquote>“Each one must give as he has decided in his heart, not reluctantly or under compulsion, for God loves a cheerful giver.”</blockquote><cite>2 Corinthians 9:7</cite></aside>
      </section>

      <section className="public-section" aria-labelledby="ways-to-give">
        <div className="public-section-heading"><h2 id="ways-to-give">Ways to Give</h2><p>Choose the giving method most convenient for you.</p></div>
        <div className="giving-grid">
          <article className="public-card giving-card"><HandCoins className="giving-icon" size={42} aria-hidden="true" /><h3>Cash</h3><p>You may give your tithes and offerings during any worship service.</p></article>
          <article className="public-card giving-card bank-card"><Landmark className="giving-icon" size={42} aria-hidden="true" /><h3>Bank Transfer</h3><p>Metropolitan Bank and Trust Company</p><div className="bank-details">
            <div className="bank-row"><span>Account Name</span><div className="bank-value"><strong>{accountName}</strong><button className="public-copy" type="button" aria-label="Copy bank account name" onClick={() => copyValue("name", accountName)}>{copiedField === "name" ? <Check size={19} /> : <Copy size={19} />}</button></div></div>
            <div className="bank-row"><span>Account Number</span><div className="bank-value"><strong>{accountNumber}</strong><button className="public-copy" type="button" aria-label="Copy bank account number" onClick={() => copyValue("number", accountNumber)}>{copiedField === "number" ? <Check size={19} /> : <Copy size={19} />}</button></div></div>
          </div></article>
          <article className="public-card giving-card qr-card"><img src={instapayQr} alt="InstaPay QR code for giving to God's Grace Community Church" /><div><Wallet className="giving-icon" size={42} aria-hidden="true" /><h3>Scan to Give</h3><p>Scan using GCash, Maya, or any InstaPay-enabled banking app.</p></div></article>
        </div>
      </section>

      <section className="public-section public-card questions-card"><div><h2>Questions about giving?</h2><p>If you need assistance or more information, we'd be happy to help.</p></div><a className="public-action" href="/contact">Contact Us</a></section>
    </PublicPage>
  );
}
