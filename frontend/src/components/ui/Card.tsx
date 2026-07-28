import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      style={{ padding: "10px" }}
      onClick={onClick}
      className={`
        rounded-xl
        border border-slate-200
        bg-white
        shadow-sm
        transition-shadow
        hover:shadow-md
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
