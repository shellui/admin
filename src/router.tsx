import { createHashRouter, Navigate } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { CompanyPage } from '@/pages/CompanyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupsListPage } from '@/pages/GroupsListPage';
import { LoginEventDetailPage } from '@/pages/LoginEventDetailPage';
import { LoginEventsListPage } from '@/pages/LoginEventsListPage';
import { OAuthSetupPage } from '@/pages/OAuthSetupPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { AccessTokensPage } from '@/pages/AccessTokensPage';
import { UserDetailPage } from '@/pages/UserDetailPage';
import { UsersListPage } from '@/pages/UsersListPage';
import { StorageStatisticsPage } from '@/pages/StorageStatisticsPage';

/**
 * Hash routes: `#/`, `#/company`, `#/users`, …
 * Chrome mode embeds these via ContentView; content mode (nested same-origin) renders the page elements.
 * External embeds (custom apps, storage files, swagger/redoc) are loaded by chrome ContentView directly —
 * their routes exist only so the chrome hash location stays bookmarkable.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AdminShellLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'groups', element: <GroupsListPage /> },
      { path: 'oauth', element: <OAuthSetupPage /> },
      { path: 'swagger', element: null },
      { path: 'redoc', element: null },
      { path: 'users/:userId', element: <UserDetailPage /> },
      { path: 'users', element: <UsersListPage /> },
      { path: 'personal-access-tokens', element: <AccessTokensPage /> },
      {
        path: 'access-tokens',
        element: (
          <Navigate
            to="/personal-access-tokens"
            replace
          />
        ),
      },
      { path: 'login-events/:eventId', element: <LoginEventDetailPage /> },
      { path: 'login-events', element: <LoginEventsListPage /> },
      { path: 'storage/statistics', element: <StorageStatisticsPage /> },
      { path: 'storage/swagger', element: null },
      { path: 'storage/redoc', element: null },
      { path: 'storage', element: null },
      { path: 'app/:appPath', element: null },
      {
        path: '*',
        element: (
          <Navigate
            to="/"
            replace
          />
        ),
      },
    ],
  },
]);
