export type OAuthProviderTier = 'popular' | 'generic' | 'other';

export type OAuthConsoleUrlKind =
  | 'app_registration'
  | 'developer_console'
  | 'app_settings'
  | 'docs'
  | 'other';

export type OAuthConsoleUrlEntry = {
  kind: OAuthConsoleUrlKind;
  url: string;
  form: string;
  placeholders?: string[];
  /** Legacy catalog fields (never shown raw in UI). */
  text?: string;
  label?: string;
};

export type OAuthExtraSettingField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  secret: boolean;
  help_text: string;
};

export type OAuthProviderIcon =
  | {
      source: 'simple-icons';
      slug: string;
      hex: string;
      title: string;
    }
  | {
      source: 'missing' | string;
      note?: string;
      fallback?: { lucide?: string };
    }
  | Record<string, unknown>;

export type OAuthCatalogProvider = {
  docs_slug: string;
  name: string;
  tier: OAuthProviderTier;
  legacy: boolean;
  replaced_by: string | null;
  protocol: string;
  supported: boolean;
  unsupported_reason: string | null;
  icon: OAuthProviderIcon;
  docs_url: string;
  console_url: OAuthConsoleUrlEntry[];
  callback_url: string;
  extra_settings_schema: OAuthExtraSettingField[];
};

export type OAuthProviderCatalogResponse = {
  catalog_version: string;
  allauth_version: string;
  callback_url: string;
  providers: OAuthCatalogProvider[];
};
