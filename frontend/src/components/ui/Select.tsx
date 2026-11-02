import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`
        w-full
        rounded-xl
        border
        border-slate-300
        bg-white
        px-4
        py-3
        min-h-12
        text-sm
        outline-none
        transition
        focus:border-emerald-600
        focus:outline-none
        ${className}
      `}
    />
  );
}
