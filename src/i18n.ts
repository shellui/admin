import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      standaloneTitle: 'Open this app from ShellUI',
      standaloneDescription:
        'The admin UI is loaded inside the main Shell application. You opened this URL directly in a browser tab.',
      standaloneStepRunShell:
        '1. Start the main ShellUI app (for example port 4000) and this dev server with pnpm start in the admin repo (port 5174).',
      standaloneStepConfigure:
        '2. In the main app’s shellui.config.ts, point the backend admin URL at this Vite server:',
      standaloneConfigSnippet: `backend: {
  type: 'shellui',
  url: 'http://localhost:8000',
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5174',
  login: { /* … */ },
},`,
      standaloneStepOpenAdmin:
        '3. Sign in as a staff user and open the Admin entry (route /admin). The shell loads this app in an iframe.',
      standaloneNoteUrl:
        'Use the same host and port as shown in your terminal. For production, set adminUrl to your deployed admin origin (for example https://admin.shellui.com/).',
      navDashboard: 'Dashboard',
      navUsers: 'Users',
      dashboardTitle: 'Operations overview',
      dashboardEnvBadge: 'scaffold',
      dashboardDescription:
        'Aggregate signals for the ShellUI control plane: request volume, latency, storage, and auth health. Wire these cards to your API or observability stack.',
      dashboardKpiSection: 'Key metrics',
      dashboardStatRequests: 'Requests / 24h',
      dashboardStatRequestsHint: 'Δ +3.2% vs prev.',
      dashboardStatLatency: 'p95 latency',
      dashboardStatLatencyHint: 'edge → API',
      dashboardStatStorage: 'Object storage',
      dashboardStatStorageHint: 'approx. compressed',
      dashboardStatAuth: 'Auth success',
      dashboardStatAuthHint: 'OAuth + session',
      dashboardChartTitle: 'Traffic shape',
      dashboardChartDescription: 'Suggested layout: bind to Prometheus, ClickHouse, or your edge logs.',
      dashboardChartCaption: 'req/min (sample envelope)',
      dashboardFeedTitle: 'Audit tail',
      dashboardFeedDescription: 'Structured events — replace with streaming admin feed.',
      dashboardFeedItem1:
        '[INFO] policy_eval id=pol_default allow subject=session_… duration=4ms',
      dashboardFeedItem2:
        '[WARN] rate_limit bucket=api scope=user remaining=42',
      dashboardFeedItem3:
        '[INFO] deploy hook acknowledged build=gha-9021 env=production',
      dashboardUiHint:
        'UI suggestion: pair KPI cards with real queries; keep monospace IDs in audit lines for grep-friendly ops.',
      usersTitle: 'Identity directory',
      usersSchemaBadge: 'users v0',
      usersDescription:
        'Directory view for staff accounts and roles. The table below is mock data — connect columns to your user store or IdP.',
      usersTableTitle: 'Accounts',
      usersTableDescription: 'Sortable grid placeholder; actions column can host impersonation / revoke.',
      usersFieldQuery: 'Query',
      usersFieldQueryPlaceholder: 'email, id, name…',
      usersFieldQueryHint: 'Server-side filter; connect to your search index or ORM.',
      usersFieldScope: 'Scope',
      usersFieldScopePlaceholder: 'all | org | tenant',
      usersFieldScopeHint: 'Restrict results to a namespace or tenant id.',
      usersFormApply: 'Apply filters',
      usersColId: 'id',
      usersColEmail: 'email',
      usersColRole: 'role',
      usersColStatus: 'status',
      usersUiHint:
        'UI suggestion: add row selection, bulk actions, and a detail drawer keyed by id (e.g. usr_*).',
      brandSubtitle: 'Administration',
    },
  },
  fr: {
    translation: {
      standaloneTitle: 'Ouvrir cette application depuis ShellUI',
      standaloneDescription:
        'L’interface d’administration est chargée dans l’application Shell principale. Vous avez ouvert cette URL directement dans un onglet.',
      standaloneStepRunShell:
        '1. Démarrez l’application ShellUI principale (par ex. port 4000) et ce serveur de dev avec pnpm start dans le dépôt admin (port 5174).',
      standaloneStepConfigure:
        '2. Dans shellui.config.ts de l’app principale, indiquez l’URL du serveur Vite pour l’admin :',
      standaloneConfigSnippet: `backend: {
  type: 'shellui',
  url: 'http://localhost:8000',
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5174',
  login: { /* … */ },
},`,
      standaloneStepOpenAdmin:
        '3. Connectez-vous en compte staff et ouvrez Admin (route /admin). La coque charge cette app dans une iframe.',
      standaloneNoteUrl:
        'Utilisez le même hôte et port qu’indiqués dans le terminal. En production, définissez adminUrl vers l’URL déployée (par ex. https://admin.shellui.com/).',
      navDashboard: 'Tableau de bord',
      navUsers: 'Utilisateurs',
      dashboardTitle: 'Vue opérations',
      dashboardEnvBadge: 'ébauche',
      dashboardDescription:
        'Signaux agrégés pour le plan de contrôle ShellUI : volume de requêtes, latence, stockage et santé auth. Branchez ces cartes sur votre API ou votre stack d’observabilité.',
      dashboardKpiSection: 'Indicateurs clés',
      dashboardStatRequests: 'Requêtes / 24h',
      dashboardStatRequestsHint: 'Δ +3,2 % vs préc.',
      dashboardStatLatency: 'Latence p95',
      dashboardStatLatencyHint: 'edge → API',
      dashboardStatStorage: 'Stockage objet',
      dashboardStatStorageHint: 'approx. compressé',
      dashboardStatAuth: 'Succès auth',
      dashboardStatAuthHint: 'OAuth + session',
      dashboardChartTitle: 'Profil de trafic',
      dashboardChartDescription:
        'Disposition suggérée : lier à Prometheus, ClickHouse ou vos journaux edge.',
      dashboardChartCaption: 'req/min (enveloppe exemple)',
      dashboardFeedTitle: 'Flux audit',
      dashboardFeedDescription: 'Événements structurés — remplacer par un flux admin temps réel.',
      dashboardFeedItem1:
        '[INFO] policy_eval id=pol_default allow subject=session_… duration=4ms',
      dashboardFeedItem2:
        '[WARN] rate_limit bucket=api scope=user remaining=42',
      dashboardFeedItem3:
        '[INFO] deploy hook acknowledged build=gha-9021 env=production',
      dashboardUiHint:
        'Suggestion UI : coupler les cartes KPI à de vraies requêtes ; garder des IDs monospace dans l’audit pour du grep ops.',
      usersTitle: 'Annuaire identités',
      usersSchemaBadge: 'users v0',
      usersDescription:
        'Vue annuaire pour comptes staff et rôles. Le tableau ci-dessous est factice — reliez les colonnes à votre store utilisateur ou IdP.',
      usersTableTitle: 'Comptes',
      usersTableDescription:
        'Grille triable (placeholder) ; la colonne actions peut héberger impersonation / révocation.',
      usersFieldQuery: 'Requête',
      usersFieldQueryPlaceholder: 'email, id, nom…',
      usersFieldQueryHint: 'Filtre côté serveur ; connecter à l’index de recherche ou l’ORM.',
      usersFieldScope: 'Périmètre',
      usersFieldScopePlaceholder: 'all | org | tenant',
      usersFieldScopeHint: 'Restreindre les résultats à un espace de noms ou tenant.',
      usersFormApply: 'Appliquer les filtres',
      usersColId: 'id',
      usersColEmail: 'email',
      usersColRole: 'rôle',
      usersColStatus: 'statut',
      usersUiHint:
        'Suggestion UI : sélection de lignes, actions de masse, tiroir détail clé par id (ex. usr_*).',
      brandSubtitle: 'Administration',
    },
  },
} as const;

export const i18nInit = i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
