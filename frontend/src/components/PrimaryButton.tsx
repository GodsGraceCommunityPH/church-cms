import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

type PrimaryButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  to?: string;
  href?: string;
  target?: "_self" | "_blank";
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  style?: CSSProperties;
  disabled?: boolean;
};

function PrimaryButton({
  children,
  variant = "primary",
  to,
  href,
  target,
  onClick,
  className = "",
  type = "button", // <-- Add this
  style,
  disabled = false,
}: PrimaryButtonProps) {
  const styles = {
    primary:
      "inline-flex h-14 items-center justify-center rounded-md bg-[#556B2F] px-6 font-semibold text-white transition-all duration-300 hover:bg-[#6B8E23] hover:shadow-lg active:scale-95",
    secondary:
      "inline-flex h-14 items-center justify-center rounded-md border-2 border-[#A3B18A] bg-transparent px-6 font-semibold text-white transition-all duration-300 hover:bg-[#A3B18A] hover:text-slate-900 hover:shadow-lg",
  };

  const buttonClass = `${styles[variant]} ${className}`;
  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "48px",
    padding: "12px 24px",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.6 : undefined,
    cursor: disabled ? "not-allowed" : undefined,
    ...style,
  };

  if (to) {
    return (
      <Link to={to} className={buttonClass} onClick={onClick} style={buttonStyle}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={buttonClass}
        style={buttonStyle}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={buttonClass} style={buttonStyle} disabled={disabled}>
      {children}
    </button>
  );
}

export default PrimaryButton;
