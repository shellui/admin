import { createHashRouter, Navigate } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupsListPage } from '@/pages/GroupsListPage';
import { UserEditPage } from '@/pages/UserEditPage';
import { UsersListPage } from '@/pages/UsersListPage';

/**
 * Hash routes: `#/`, `#/users?q=&page=`, `#/users/:userId`. Same-origin iframe paths stay bookmarkable.
 * Edit route is registered before the list route so `#/users` always hits the directory table.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AdminShellLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'groups', element: <GroupsListPage /> },
      { path: 'users/:userId', element: <UserEditPage /> },
      { path: 'users', element: <UsersListPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
