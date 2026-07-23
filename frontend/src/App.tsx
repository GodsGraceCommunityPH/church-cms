import { Routes, Route } from "react-router-dom";

import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";

import Members from "./pages/admin/Members";
import MemberForm from "./pages/admin/MemberForm";
import CellGroups from "./pages/admin/CellGroups";
import Ministries from "./pages/admin/Ministries";
import Giving from "./pages/admin/Giving";
import Settings from "./pages/admin/Setting";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import GivePage from "./pages/GivePage";

import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";

function App() {
  return (
    <Routes>
      {/* Public Website */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/give" element={<GivePage />} />
      </Route>

      {/* Staff Portal Login */}
      <Route path="/admin" element={<Login />} />

      {/* Admin Portal */}
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<Dashboard />} />

        <Route path="/admin/members" element={<Members />} />
        <Route path="/admin/members/new" element={<MemberForm />} />
        <Route path="/admin/members/:id/edit" element={<MemberForm />} />

        <Route path="/admin/cell-groups" element={<CellGroups />} />
        <Route path="/admin/ministries" element={<Ministries />} />
        <Route path="/admin/giving" element={<Giving />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
