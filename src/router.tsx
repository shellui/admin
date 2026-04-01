import { createHashRouter, Navigate } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';

/**
 * Hash routes: `#/` (dashboard), `#/users`. Keeps location in sync with the sidebar.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AdminShellLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
