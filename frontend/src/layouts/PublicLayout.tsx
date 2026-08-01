import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTop from "../components/ScrollToTop";
import PersistentBackButton from "../components/PersistentBackButton";

function PublicLayout() {
  return (
    <div className="font-body">
      <ScrollToTop />

      <Navbar />

      <PersistentBackButton fallback="/" hiddenPaths={["/"]} />

      <Outlet />

      <Footer />
    </div>
  );
}

export default PublicLayout;
