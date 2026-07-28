import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`
        w-full
        rounded-lg
        border
        border-slate-300
        bg-white
        px-3
        py-2
        text-sm
        outline-none
        transition
        focus:border-blue-500
        focus:ring-2
        focus:ring-blue-100
        ${className}
      `}
    />
  );
}
