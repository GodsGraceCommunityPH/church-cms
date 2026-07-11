import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ServiceSchedule from "./components/ServiceSchedule";
import Welcome from "./components/Welcome";
import About from "./components/About";

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <Welcome />

      <div className="py-16"></div>

      <ServiceSchedule />
      <About />
    </>
  );
}

export default App;
