import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`
        w-full
        rounded-xl
        border
        border-slate-300
        px-4
        py-3
        min-h-24
        text-sm
        outline-none
        transition
        focus:border-emerald-600
        focus:outline-none
        ${className}
      `}
      style={{ resize: "vertical" }}
    />
  );
}
