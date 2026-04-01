import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';

export default function App() {
  return (
    <div className="font-body text-foreground antialiased">
      <Routes>
        <Route element={<AdminShellLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  );
}
