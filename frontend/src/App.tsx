import { Routes, Route } from "react-router-dom";

import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";

import Members from "./pages/admin/Members";
import MemberForm from "./pages/admin/MemberForm";
import CellGroups from "./pages/admin/CellGroups";
import Ministries from "./pages/admin/Ministries";
import MinistryForm from "./pages/admin/MinistryForm";
import MinistryProfile from "./pages/admin/MinistryProfile";
import Giving from "./pages/admin/Giving";
import Settings from "./pages/admin/Setting";
import MemberProfile from "./pages/admin/MemberProfile";
import CellGroupForm from "./pages/admin/CellGroupForm";
import CellGroupProfile from "./pages/admin/CellGroupProfile";
import JoinCellGroup from "./pages/JoinCellGroup";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import PastorProfilePage from "./pages/PastorProfilePage";
import ContactPage from "./pages/ContactPage";
import GivePage from "./pages/GivePage";
import GalleryPage from "./pages/GalleryPage";
import GalleryArchivePage from "./pages/GalleryArchivePage";

import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Training from "./pages/admin/Training";
import TrainingProgram from "./pages/admin/TrainingProgram";
import MemberTrainingProfile from "./pages/admin/MemberTrainingProfile";
import PendingTraining from "./pages/admin/PendingTraining";
import TrainingBatch from "./pages/admin/TrainingBatch";
import Equipment from "./pages/admin/Equipment";
import EquipmentForm from "./pages/admin/EquipmentForm";
import EquipmentDetail from "./pages/admin/EquipmentDetail";
import Events from "./pages/admin/Events";
import EventForm from "./pages/admin/EventForm";
import EventDetail from "./pages/admin/EventDetail";
import EventRegistrationPage from "./pages/EventRegistrationPage";
import WorshipMessages from "./pages/admin/WorshipMessages";
import WorshipMessageForm from "./pages/admin/WorshipMessageForm";
import ChurchLife from "./pages/admin/ChurchLife";
import ChurchLifeForm from "./pages/admin/ChurchLifeForm";
import HelpCenter from "./pages/admin/HelpCenter";
import HelpArticle from "./pages/admin/HelpArticle";
import {
  PermissionRoute,
  ProtectedRoute,
} from "./features/auth/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public Website */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/about/pastors/:pastorSlug" element={<PastorProfilePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/give" element={<GivePage />} />
        <Route path="/gallery/:albumSlug" element={<GalleryPage />} />
        <Route path="/gallery" element={<GalleryArchivePage />} />
        <Route path="/join/:token" element={<JoinCellGroup />} />
        <Route path="/events/:slug" element={<EventRegistrationPage />} />
        <Route path="/events/:slug/register" element={<EventRegistrationPage />} />
      </Route>

      {/* Staff Portal Login */}
      <Route path="/admin" element={<Login />} />

      {/* Authenticated Admin Portal */}
      <Route element={<ProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/help" element={<HelpCenter />} />
        <Route path="/admin/help/:articleKey" element={<HelpArticle />} />
        <Route element={<PermissionRoute permission="training.view" />}>
        <Route path="/admin/training" element={<Training />} />
        <Route path="/admin/training/pending" element={<PendingTraining />} />
        <Route
          path="/admin/training/:programSlug"
          element={<TrainingProgram />}
        />
        <Route
          path="/admin/training/:programSlug/cycles/:batchId"
          element={<TrainingBatch />}
        />
        <Route
          path="/admin/training/:programSlug/members/:enrollmentId"
          element={<MemberTrainingProfile />}
        />
        </Route>

        <Route element={<PermissionRoute permission="members.view" />}>
        <Route path="/admin/members" element={<Members />} />
        <Route path="/admin/members/:id" element={<MemberProfile />} />
        </Route>
        <Route element={<PermissionRoute permission="members.create" />}>
          <Route path="/admin/members/new" element={<MemberForm />} />
        </Route>
        <Route element={<PermissionRoute permission="members.update" />}>
          <Route path="/admin/members/:id/edit" element={<MemberForm />} />
        </Route>

        <Route element={<PermissionRoute permission="cell_groups.view" />}>
        <Route path="/admin/cell-groups" element={<CellGroups />} />
        <Route path="/admin/cell-groups/:id" element={<CellGroupProfile />} />
        </Route>
        <Route element={<PermissionRoute permission="cell_groups.manage" />}>
          <Route path="/admin/cell-groups/new" element={<CellGroupForm />} />
          <Route path="/admin/cell-groups/:id/edit" element={<CellGroupForm />} />
        </Route>
        <Route element={<PermissionRoute permission="ministries.view" />}>
        <Route path="/admin/ministries" element={<Ministries />} />
        <Route path="/admin/ministries/:id" element={<MinistryProfile />} />
        </Route>
        <Route element={<PermissionRoute permission="ministries.manage" />}>
          <Route path="/admin/ministries/new" element={<MinistryForm />} />
          <Route path="/admin/ministries/:id/edit" element={<MinistryForm />} />
        </Route>
        <Route element={<PermissionRoute permission="finance.view" />}>
        <Route path="/admin/giving" element={<Giving />} />
        </Route>
        <Route element={<PermissionRoute permission="equipment.view" />}>
          <Route path="/admin/equipment" element={<Equipment />} />
          <Route path="/admin/equipment/:id" element={<EquipmentDetail />} />
        </Route>
        <Route element={<PermissionRoute permission="equipment.manage" />}>
          <Route path="/admin/equipment/new" element={<EquipmentForm />} />
          <Route path="/admin/equipment/:id/edit" element={<EquipmentForm />} />
        </Route>
        <Route element={<PermissionRoute permission="events.view" />}>
          <Route path="/admin/events" element={<Events />} />
          <Route path="/admin/events/:id" element={<EventDetail />} />
        </Route>
        <Route element={<PermissionRoute permission="events.manage" />}>
          <Route path="/admin/events/new" element={<EventForm />} />
          <Route path="/admin/events/:id/edit" element={<EventForm />} />
        </Route>
        <Route element={<PermissionRoute permission="website_content.view" />}>
          <Route path="/admin/worship-messages" element={<WorshipMessages />} />
          <Route path="/admin/church-life" element={<ChurchLife />} />
        </Route>
        <Route element={<PermissionRoute permission="website_content.manage" />}>
          <Route path="/admin/worship-messages/new" element={<WorshipMessageForm />} />
          <Route path="/admin/worship-messages/:id/edit" element={<WorshipMessageForm />} />
          <Route path="/admin/church-life/new" element={<ChurchLifeForm />} />
          <Route path="/admin/church-life/:id/edit" element={<ChurchLifeForm />} />
        </Route>
        <Route element={<PermissionRoute permission="admin.settings" />}>
        <Route path="/admin/settings" element={<Settings />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  );
}

export default App;
