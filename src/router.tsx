import { createHashRouter, Navigate, useParams } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { CompanyPage } from '@/pages/CompanyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupsListPage } from '@/pages/GroupsListPage';
import { LoginEventDetailPage } from '@/pages/LoginEventDetailPage';
import { LoginEventsListPage } from '@/pages/LoginEventsListPage';
import { ActionsDeliveriesListPage } from '@/features/actions/pages/ActionsDeliveriesListPage';
import { ActionsDeliveryDetailPage } from '@/features/actions/pages/ActionsDeliveryDetailPage';
import { ActionsRuleEditorPage } from '@/features/actions/pages/ActionsRuleEditorPage';
import { ActionsRulesListPage } from '@/features/actions/pages/ActionsRulesListPage';
import { OAuthSetupPage } from '@/pages/OAuthSetupPage';
import { ScimSetupPage } from '@/pages/ScimSetupPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { AccessTokensPage } from '@/pages/AccessTokensPage';
import { UserDetailPage } from '@/pages/UserDetailPage';
import { UsersListPage } from '@/pages/UsersListPage';
import { HostingAppDetailPage } from '@/pages/HostingAppDetailPage';
import { HostingAppsPage } from '@/pages/HostingAppsPage';
import { HostingStatisticsPage } from '@/pages/HostingStatisticsPage';
import { StorageStatisticsPage } from '@/pages/StorageStatisticsPage';

function LegacyActionsRuleRedirect() {
  const { ruleId } = useParams();
  const suffix = ruleId ? encodeURIComponent(ruleId) : '';
  return (
    <Navigate
      to={suffix ? `/webhooks/${suffix}` : '/webhooks'}
      replace
    />
  );
}

function LegacyActionsDeliveryRedirect() {
  const { deliveryId } = useParams();
  return (
    <Navigate
      to={
        deliveryId
          ? `/webhooks/deliveries/${encodeURIComponent(deliveryId)}`
          : '/webhooks/deliveries'
      }
      replace
    />
  );
}

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
      { path: 'scim', element: <ScimSetupPage /> },
      { path: 'webhooks/deliveries/:deliveryId', element: <ActionsDeliveryDetailPage /> },
      { path: 'webhooks/deliveries', element: <ActionsDeliveriesListPage /> },
      { path: 'webhooks/new', element: <ActionsRuleEditorPage /> },
      { path: 'webhooks/:ruleId', element: <ActionsRuleEditorPage /> },
      { path: 'webhooks', element: <ActionsRulesListPage /> },
      {
        path: 'actions/rules/new',
        element: (
          <Navigate
            to="/webhooks/new"
            replace
          />
        ),
      },
      { path: 'actions/rules/:ruleId', element: <LegacyActionsRuleRedirect /> },
      {
        path: 'actions/rules',
        element: (
          <Navigate
            to="/webhooks"
            replace
          />
        ),
      },
      {
        path: 'actions/deliveries/:deliveryId',
        element: <LegacyActionsDeliveryRedirect />,
      },
      {
        path: 'actions/deliveries',
        element: (
          <Navigate
            to="/webhooks/deliveries"
            replace
          />
        ),
      },
      {
        path: 'actions',
        element: (
          <Navigate
            to="/webhooks"
            replace
          />
        ),
      },
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
      { path: 'hosting/apps/:name', element: <HostingAppDetailPage /> },
      { path: 'hosting/statistics', element: <HostingStatisticsPage /> },
      { path: 'hosting/swagger', element: null },
      { path: 'hosting/redoc', element: null },
      { path: 'hosting', element: <HostingAppsPage /> },
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
