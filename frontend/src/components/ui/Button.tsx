import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  to?: string;
  variant?: "primary" | "secondary" | "danger";
}

export default function Button({
  children,
  to,
  variant = "primary",
  className = "",
  style,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors";

  const variantClasses = {
    primary: "bg-olive-700 text-white hover:bg-olive-800",
    secondary:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;
  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "40px",
    padding: "10px 16px",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    ...style,
  };

  if (to) {
    return (
      <Link to={to} className={classes} style={buttonStyle}>
        {children}
      </Link>
    );
  }

  return (
    <button style={buttonStyle} className={classes} {...props}>
      {children}
    </button>
  );
}
