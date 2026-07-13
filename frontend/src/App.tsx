import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import GivePage from "./pages/GivePage";
import ScrollToTop from "./components/ScrollToTop";
import ChurchInfoBar from "./components/ChurchInfoBar";

function App() {
  return (
    <div className="font-body">
      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/give" element={<GivePage />} />
      </Routes>

      <ChurchInfoBar />
      <Footer />
    </div>
  );
}

export default App;
