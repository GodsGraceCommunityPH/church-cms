import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type PrimaryButtonProps = {
  children: ReactNode;
  variant?: "solid" | "hero";
  to?: string;
  href?: string;
  target?: "_self" | "_blank";
  onClick?: () => void;
  className?: string;
};

function PrimaryButton({
  children,
  variant = "solid",
  to,
  href,
  target,
  onClick,
  className = "",
}: PrimaryButtonProps) {
  const styles = {
    solid:
      "inline-flex items-center justify-center gap-2 rounded-xl bg-[#556B2F] px-10 py-5 font-semibold text-white transition-all duration-300 hover:bg-[#6B8E23] hover:scale-105 active:scale-95 min-w-[220px]",

    hero: "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#556B2F] px-10 py-5 text-center font-semibold text-white transition-all duration-300 hover:bg-[#6B8E23] hover:scale-105 md:min-w-[240px] md:w-auto",
  };

  const buttonClass = `${styles[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={buttonClass} onClick={onClick}>
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
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={buttonClass}>
      {children}
    </button>
  );
}

export default PrimaryButton;
