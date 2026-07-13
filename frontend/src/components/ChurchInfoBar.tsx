import { Sun, BookOpen, Sunset, House } from "lucide-react";

function ChurchInfoBar() {
  return (
    <section className="bg-[#556B2F] text-white">
      <div
        className="mx-auto py-6"
        style={{
          maxWidth: "1400px",
          paddingLeft: "24px",
          paddingRight: "24px",
        }}
      >
        {/* Mobile */}
        <div className="grid grid-cols-2 gap-6 md:hidden">
          <div className="flex items-center gap-3">
            <Sun size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">Sunday Worship</p>
              <p className="text-sm text-white/80">10:00 AM – 11:30 AM</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BookOpen size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">Lifeline</p>
              <p className="text-sm text-white/80">12:30 PM</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Sunset size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">Sunday Worship</p>
              <p className="text-sm text-white/80">2:00 PM – 3:30 PM</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <House size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">Lighthouse</p>
              <p className="text-sm text-white/80">4:00 PM</p>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden items-center justify-center gap-12 md:flex">
          <div className="flex w-[230px] items-center gap-4">
            <Sun size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">AM Celebration</p>
              <p className="text-sm text-white/80">10:00 AM – 11:30 AM</p>
            </div>
          </div>

          <div className="h-10 w-px bg-white/20" />

          <div className="flex w-[230px] items-center gap-4">
            <Sunset size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">PM Celebration</p>
              <p className="text-sm text-white/80">2:00 PM – 3:30 PM</p>
            </div>
          </div>

          <div className="h-10 w-px bg-white/20" />

          <div className="flex w-[180px] items-center gap-4">
            <BookOpen size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">Lifeline</p>
              <p className="text-sm text-white/80">12:30 PM</p>
            </div>
          </div>

          <div className="h-10 w-px bg-white/20" />

          <div className="flex w-[170px] items-center gap-4">
            <House size={28} className="shrink-0" />
            <div>
              <p className="font-semibold">Lighthouse</p>
              <p className="text-sm text-white/80">4:00 PM</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ChurchInfoBar;
