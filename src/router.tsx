import { createHashRouter, Navigate } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { CompanyPage } from '@/pages/CompanyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupsListPage } from '@/pages/GroupsListPage';
import { LoginEventDetailPage } from '@/pages/LoginEventDetailPage';
import { LoginEventsListPage } from '@/pages/LoginEventsListPage';
import { UserDetailPage } from '@/pages/UserDetailPage';
import { UsersListPage } from '@/pages/UsersListPage';

/**
 * Hash routes: `#/`, `#/company`, `#/users`, …
 * Detail routes are registered before list routes so directory URLs resolve to tables.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AdminShellLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'groups', element: <GroupsListPage /> },
      { path: 'users/:userId', element: <UserDetailPage /> },
      { path: 'users', element: <UsersListPage /> },
      { path: 'login-events/:eventId', element: <LoginEventDetailPage /> },
      { path: 'login-events', element: <LoginEventsListPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
