import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./PersistentBackButton.css";

type PersistentBackButtonProps = {
  fallback: string;
  hiddenPaths?: string[];
};

export default function PersistentBackButton({
  fallback,
  hiddenPaths = [],
}: PersistentBackButtonProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (hiddenPaths.includes(pathname)) return null;

  const goBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  };

  return (
    <button
      className="persistent-back-button"
      type="button"
      onClick={goBack}
      aria-label="Go back to the previous page"
    >
      <ArrowLeft size={19} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
