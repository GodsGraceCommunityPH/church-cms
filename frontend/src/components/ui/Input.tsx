import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
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
});

export default Input;
