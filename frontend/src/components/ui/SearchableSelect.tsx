import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Option {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = value ? options.find((o) => o.id === value) : undefined;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "10px 14px",
          minHeight: 44,
          boxSizing: "border-box",
          cursor: "pointer",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "#64748b",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "white",
            maxHeight: 250,
            overflowY: "auto",
            zIndex: 999,
          }}
        >
          {/* Search box */}
          <div
            style={{
              padding: 8,
              borderBottom: "1px solid #ddd",
            }}
          >
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Options */}
          {filteredOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setSearch("");
                setOpen(false);
              }}
              style={{
                padding: "10px",
                cursor: "pointer",
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
