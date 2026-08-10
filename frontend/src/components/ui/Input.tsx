import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
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
});

export default Input;
