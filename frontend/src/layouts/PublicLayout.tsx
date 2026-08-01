import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTop from "../components/ScrollToTop";

function PublicLayout() {
  return (
    <div className="font-body">
      <ScrollToTop />

      <Navbar />

      <Outlet />

      <Footer />
    </div>
  );
}

export default PublicLayout;
