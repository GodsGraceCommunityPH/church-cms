import { Menu } from "lucide-react";

type TopbarProps = {
  onMenuClick: () => void;
};

function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="flex h-[70px] items-center justify-between border-b border-gray-200 bg-white px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 hover:bg-gray-100 md:hidden"
        >
          <Menu size={24} />
        </button>

        <h1 className="text-xl font-semibold">Admin Portal</h1>
      </div>
    </header>
  );
}

export default Topbar;
