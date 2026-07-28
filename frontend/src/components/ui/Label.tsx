import type { LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export default function Label({
  className = "",
  children,
  ...props
}: LabelProps) {
  return (
    <label
      {...props}
      className={`
        mb-2
        block
        text-sm
        font-medium
        text-slate-700
        ${className}
      `}
    >
      {children}
    </label>
  );
}
