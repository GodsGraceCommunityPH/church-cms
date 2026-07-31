import { Clock, Video } from "lucide-react";

export default function PrayerMeetings() {
  const PRAYER_ZOOM =
    "https://us06web.zoom.us/j/83883523884?pwd=J5OBmIp8gfmoOLqMCExebzvmaQaT8F.1&fbclid=IwY2xjawP4jI1leHRuA2FlbQIxMABicmlkETF2UWxtMmdZNFpqME1DTXF6c3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHoV4Sz_OJOE4iUNGXXIQbtTrgyQgyo9O4hxEiidmeq9vdZqxZX1HTYsNpASd_aem_0VLSZPXUuwmz9mZ57CryHw#success";

  return (
    <section className="bg-[#F8F7F3] py-16" style={{ padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm" style={{ padding: "clamp(24px,5vw,40px)", borderRadius: 24 }}>
          <div className="flex justify-center">
            <Clock size={42} className="text-[#556B2F]" />
          </div>

          <h2 className="mt-6 text-center text-3xl font-heading font-semibold text-slate-900">
            Online Prayer Meetings
          </h2>

          <div className="mt-10 space-y-8">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900">
                Daily Morning Prayer
              </h3>

              <p className="mt-2 text-slate-600">
                Every day at <strong>6:00 AM</strong>
              </p>
            </div>

            <div className="border-t border-slate-200 pt-8 text-center">
              <h3 className="text-xl font-semibold text-slate-900">
                Wednesday Prayer Meeting
              </h3>

              <p className="mt-2 text-slate-600">
                Every Wednesday at <strong>8:00 PM</strong>
              </p>
            </div>
          </div>

          <a
            style={{ display: "inline-flex", width: "100%", maxWidth: 360, minHeight: 50, gap: 10, padding: "12px 22px", margin: "32px auto 0", boxSizing: "border-box" }}
            href={PRAYER_ZOOM}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 flex items-center justify-center rounded-xl bg-[#556B2F] font-semibold text-white transition hover:bg-[#6B8E23] hover:shadow-lg"
          >
            <Video size={18} />
            Join via Zoom
          </a>
        </div>
      </div>
    </section>
  );
}
