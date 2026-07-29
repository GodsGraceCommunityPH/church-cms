import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ChurchInfoBar from "../components/ChurchInfoBar";
import PrayerMeetings from "../components/PrayerMeetings";
import ScrollToTop from "../components/ScrollToTop";

function PublicLayout() {
  return (
    <div className="font-body">
      <ScrollToTop />

      <Navbar />

      <Outlet />

      <ChurchInfoBar />

      <PrayerMeetings />

      <Footer />
    </div>
  );
}

export default PublicLayout;
