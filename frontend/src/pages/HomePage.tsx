import Hero from "../components/Hero";
import ServiceSchedule from "../components/ServiceSchedule";
import PreviousWorship from "../components/PreviousWorship";
import PrayerMeetings from "../components/PrayerMeetings";
import CommunityGallery from "../components/CommunityGallery";
import "./HomePage.css";

function HomePage() {
  return (
    <main className="home-page">
      <Hero />
      <ServiceSchedule />
      <PreviousWorship />
      <PrayerMeetings />
      <CommunityGallery />
    </main>
  );
}

export default HomePage;
