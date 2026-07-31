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
import ContactPage from "./pages/ContactPage";
import GivePage from "./pages/GivePage";

import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Training from "./pages/admin/Training";
import TrainingProgram from "./pages/admin/TrainingProgram";
import MemberTrainingProfile from "./pages/admin/MemberTrainingProfile";
import PendingTraining from "./pages/admin/PendingTraining";
import TrainingBatch from "./pages/admin/TrainingBatch";
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
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/give" element={<GivePage />} />
      </Route>

      {/* Staff Portal Login */}
      <Route path="/admin" element={<Login />} />

      {/* Authenticated Admin Portal */}
      <Route element={<ProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route element={<PermissionRoute permission="training.view" />}>
        <Route path="/admin/training" element={<Training />} />
        <Route path="/admin/training/pending" element={<PendingTraining />} />
        <Route
          path="/admin/training/:programSlug"
          element={<TrainingProgram />}
        />
        <Route
          path="/admin/training/:programSlug/batches/:batchId"
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
        <Route path="/join/:token" element={<JoinCellGroup />} />
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
        <Route element={<PermissionRoute permission="admin.settings" />}>
        <Route path="/admin/settings" element={<Settings />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  );
}

export default App;
