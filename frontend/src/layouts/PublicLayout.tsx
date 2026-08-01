import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ChurchInfoBar from "../components/ChurchInfoBar";
import PrayerMeetings from "../components/PrayerMeetings";
import ScrollToTop from "../components/ScrollToTop";
import PersistentBackButton from "../components/PersistentBackButton";

function PublicLayout() {
  return (
    <div className="font-body">
      <ScrollToTop />

      <Navbar />

      <PersistentBackButton fallback="/" hiddenPaths={["/"]} />

      <Outlet />

      <ChurchInfoBar />

      <PrayerMeetings />

      <Footer />
    </div>
  );
}

export default PublicLayout;
