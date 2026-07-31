import Hero from "../components/Hero";
import Welcome from "../components/Welcome";
import ServiceSchedule from "../components/ServiceSchedule";
import PreviousWorship from "../components/PreviousWorship";
import CommunityGallery from "../components/CommunityGallery";

function HomePage() {
  return (
    <>
      <Hero />
      <Welcome />
      <ServiceSchedule />
      <CommunityGallery />
      <PreviousWorship />
    </>
  );
}

export default HomePage;
