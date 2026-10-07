import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { SchedulePage } from "./components/schedule/SchedulePage";
import { TeamPage } from "./components/team/TeamPage";
import { UrgentReassignmentPage } from "./components/urgentReassignment/UrgentReassignmentPage";
import { ReportsPage } from "./components/reports/ReportsPage";
import { SettingsPage } from "./components/settings/SettingsPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/urgent" element={<UrgentReassignmentPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}
