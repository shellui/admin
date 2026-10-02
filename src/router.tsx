import { createHashRouter, Navigate, useParams } from 'react-router-dom';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';
import { CompanyPage } from '@/pages/CompanyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupsListPage } from '@/pages/GroupsListPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { EventsListPage } from '@/pages/EventsListPage';
import { ActionsDeliveriesListPage } from '@/features/actions/pages/ActionsDeliveriesListPage';
import { ActionsDeliveryDetailPage } from '@/features/actions/pages/ActionsDeliveryDetailPage';
import { ActionsRuleEditorPage } from '@/features/actions/pages/ActionsRuleEditorPage';
import { ActionsRulesListPage } from '@/features/actions/pages/ActionsRulesListPage';
import { OAuthSetupPage } from '@/pages/OAuthSetupPage';
import { ScimSetupPage } from '@/pages/ScimSetupPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { AccessTokensPage } from '@/pages/AccessTokensPage';
import { InviteUserPage } from '@/pages/InviteUserPage';
import { INVITATIONS_ROUTE, INVITE_ROUTE } from '@/lib/inviteModal';
import { PendingInvitationsPage } from '@/pages/PendingInvitationsPage';
import { UserDetailPage } from '@/pages/UserDetailPage';
import { UsersListPage } from '@/pages/UsersListPage';
import { HostingAppDetailPage } from '@/pages/HostingAppDetailPage';
import { HostingAppsPage } from '@/pages/HostingAppsPage';
import { HostingStatisticsPage } from '@/pages/HostingStatisticsPage';
import { StorageStatisticsPage } from '@/pages/StorageStatisticsPage';
import {
  legacyWebhooksRedirectTarget,
  webhookDeliveriesPath,
  webhookDeliveryDetailPath,
  webhookRuleEditPath,
  webhookRulesListPath,
  webhookRulesNewPath,
} from '@/lib/webhookRoutePaths';

function LegacyWebhooksCatchAll() {
  const { '*': rest } = useParams();
  const pathname = rest?.trim() ? `/webhooks/${rest.trim()}` : '/webhooks';
  return (
    <Navigate
      to={legacyWebhooksRedirectTarget(pathname)}
      replace
    />
  );
}

function LegacyActionsRuleRedirect() {
  const { ruleId } = useParams();
  return (
    <Navigate
      to={ruleId ? webhookRuleEditPath('identity', ruleId) : webhookRulesListPath('identity')}
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
          ? webhookDeliveryDetailPath('identity', deliveryId)
          : webhookDeliveriesPath('identity')
      }
      replace
    />
  );
}

const identityWebhookRoutes = [
  { path: 'identity/webhooks/deliveries/:deliveryId', element: <ActionsDeliveryDetailPage /> },
  { path: 'identity/webhooks/deliveries', element: <ActionsDeliveriesListPage /> },
  { path: 'identity/webhooks/new', element: <ActionsRuleEditorPage /> },
  { path: 'identity/webhooks/:ruleId', element: <ActionsRuleEditorPage /> },
  { path: 'identity/webhooks', element: <ActionsRulesListPage /> },
] as const;

const hostingWebhookRoutes = [
  { path: 'hosting/webhooks/deliveries/:deliveryId', element: <ActionsDeliveryDetailPage /> },
  { path: 'hosting/webhooks/deliveries', element: <ActionsDeliveriesListPage /> },
  { path: 'hosting/webhooks/new', element: <ActionsRuleEditorPage /> },
  { path: 'hosting/webhooks/:ruleId', element: <ActionsRuleEditorPage /> },
  { path: 'hosting/webhooks', element: <ActionsRulesListPage /> },
] as const;

const storageWebhookRoutes = [
  { path: 'storage/webhooks/deliveries/:deliveryId', element: <ActionsDeliveryDetailPage /> },
  { path: 'storage/webhooks/deliveries', element: <ActionsDeliveriesListPage /> },
  { path: 'storage/webhooks/new', element: <ActionsRuleEditorPage /> },
  { path: 'storage/webhooks/:ruleId', element: <ActionsRuleEditorPage /> },
  { path: 'storage/webhooks', element: <ActionsRulesListPage /> },
] as const;

/**
 * Hash routes: `#/`, `#/company`, `#/users`, …
 * Chrome mode embeds these via ContentView; content mode (nested same-origin) renders the page elements.
 * External embeds (custom apps, storage files, swagger/redoc) are loaded by chrome ContentView directly —
 * their routes exist only so the chrome hash location stays bookmarkable.
 */
export const router = createHashRouter([
  { path: INVITE_ROUTE, element: <InviteUserPage />, errorElement: <RouteErrorPage /> },
  {
    path: INVITATIONS_ROUTE,
    element: <PendingInvitationsPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: <AdminShellLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'groups', element: <GroupsListPage /> },
      { path: 'oauth/*', element: <OAuthSetupPage /> },
      { path: 'scim', element: <ScimSetupPage /> },
      ...identityWebhookRoutes,
      ...hostingWebhookRoutes,
      ...storageWebhookRoutes,
      {
        path: 'webhooks/*',
        element: <LegacyWebhooksCatchAll />,
      },
      {
        path: 'webhooks',
        element: (
          <Navigate
            to={webhookRulesListPath('identity')}
            replace
          />
        ),
      },
      {
        path: 'actions/rules/new',
        element: (
          <Navigate
            to={webhookRulesNewPath('identity')}
            replace
          />
        ),
      },
      { path: 'actions/rules/:ruleId', element: <LegacyActionsRuleRedirect /> },
      {
        path: 'actions/rules',
        element: (
          <Navigate
            to={webhookRulesListPath('identity')}
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
            to={webhookDeliveriesPath('identity')}
            replace
          />
        ),
      },
      {
        path: 'actions',
        element: (
          <Navigate
            to={webhookRulesListPath('identity')}
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
      { path: 'events/:eventId', element: <EventDetailPage key="identity" /> },
      { path: 'events', element: <EventsListPage key="identity" /> },
      {
        path: 'login-events/*',
        element: (
          <Navigate
            to="/events"
            replace
          />
        ),
      },
      {
        path: 'storage/events/:eventId',
        element: (
          <EventDetailPage
            key="storage"
            service="storage"
          />
        ),
      },
      {
        path: 'storage/events',
        element: (
          <EventsListPage
            key="storage"
            service="storage"
          />
        ),
      },
      { path: 'storage/statistics', element: <StorageStatisticsPage /> },
      { path: 'storage/swagger', element: null },
      { path: 'storage/redoc', element: null },
      { path: 'storage', element: null },
      { path: 'hosting/apps/:name', element: <HostingAppDetailPage /> },
      {
        path: 'hosting/events/:eventId',
        element: (
          <EventDetailPage
            key="hosting"
            service="hosting"
          />
        ),
      },
      {
        path: 'hosting/events',
        element: (
          <EventsListPage
            key="hosting"
            service="hosting"
          />
        ),
      },
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
