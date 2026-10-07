import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { SearchField } from '@/features/email/components/SearchField';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import { fetchAdminGroups, type AdminGroupRow } from '@/lib/adminGroupsApi';
import { fetchAdminUser, fetchAdminUsers, type AdminUserRow } from '@/lib/adminUsersApi';
import {
  BROADCAST_ACCESS,
  BROADCAST_ROLES,
  emptyAudience,
  parsePastedEmails,
  type BroadcastAudience,
  type BroadcastAudienceMode,
  type BroadcastRole,
} from '@/lib/emailBroadcasts';
import type { Newsletter } from '@/lib/emailNewsletters';

type PickedUser = { id: number; label: string };

function userLabel(user: AdminUserRow): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name ? `${name} (${user.email})` : user.email || user.username;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

const DATE_FIELDS = [
  ['joined_after', 'joined_before', 'emailBroadcastJoined'],
  ['seen_after', 'seen_before', 'emailBroadcastSeen'],
] as const;

/** Who gets the broadcast: members matching filters, chosen people, or a newsletter list. */
export function BroadcastAudienceBuilder({
  accessToken,
  value,
  onChange,
  newsletters,
}: {
  accessToken: string;
  value: BroadcastAudience;
  onChange: (next: BroadcastAudience) => void;
  /** The company's lists. Null while loading. */
  newsletters: Newsletter[] | null;
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<AdminGroupRow[] | null>(null);
  const [groupsError, setGroupsError] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [known, setKnown] = useState<Record<number, string>>({});
  const [pasted, setPasted] = useState(value.emails.join('\n'));
  const invalid = parsePastedEmails(pasted).invalid;

  useEffect(() => {
    let cancelled = false;
    fetchAdminGroups(accessToken)
      .then((rows) => !cancelled && setGroups(rows))
      .catch(() => !cancelled && setGroupsError(true));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    const missing = value.user_ids.filter((id) => !(id in known)).slice(0, 50);
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map((id) =>
        fetchAdminUser(accessToken, id)
          .then((user) => [id, userLabel(user)] as const)
          .catch(() => [id, `#${id}`] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setKnown((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, value.user_ids, known]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      fetchAdminUsers(accessToken, { q, pageSize: 8 })
        .then((page) => !cancelled && setResults(page.results))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken, query]);

  const set = (patch: Partial<BroadcastAudience>) => onChange({ ...value, ...patch });
  const picked: PickedUser[] = value.user_ids.map((id) => ({ id, label: known[id] ?? `#${id}` }));

  function addUser(user: AdminUserRow) {
    setKnown((prev) => ({ ...prev, [user.id]: userLabel(user) }));
    if (!value.user_ids.includes(user.id)) set({ user_ids: [...value.user_ids, user.id] });
  }

  function changePasted(text: string) {
    setPasted(text);
    set({ emails: parsePastedEmails(text).emails });
  }

  function changeMode(mode: BroadcastAudienceMode) {
    if (mode === 'newsletter') {
      const listId = value.list_id ?? newsletters?.[0]?.id;
      onChange({ ...emptyAudience(), mode, ...(listId ? { list_id: listId } : {}) });
      return;
    }
    const next: BroadcastAudience = { ...value, mode };
    delete next.list_id;
    onChange(next);
  }

  return (
    <div className="space-y-5">
      <SegmentedControl
        label={t('emailBroadcastAudienceMode')}
        value={value.mode}
        options={[
          { value: 'filter', label: t('emailBroadcastModeFilter') },
          { value: 'pick', label: t('emailBroadcastModePick') },
          { value: 'newsletter', label: t('emailBroadcastModeNewsletter') },
        ]}
        onChange={changeMode}
      />

      {value.mode === 'newsletter' ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('emailBroadcastNewsletterList')}</legend>
          <Text className="text-xs">{t('emailBroadcastNewsletterHint')}</Text>
          {!newsletters ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : newsletters.length === 0 ? (
            <Text className="text-sm">
              {t('emailBroadcastNoNewsletters')}{' '}
              <Link
                to="/email/newsletters"
                className="text-primary underline-offset-2 hover:underline"
              >
                {t('emailBroadcastOpenNewsletters')}
              </Link>
            </Text>
          ) : (
            <div className="space-y-1">
              {newsletters.map((newsletter) => (
                <label
                  key={newsletter.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="broadcast-newsletter"
                    className="size-4"
                    checked={value.list_id === newsletter.id}
                    onChange={() => onChange({ ...value, list_id: newsletter.id })}
                  />
                  <span>{newsletter.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('emailNewsletterConfirmedCount', { count: newsletter.counts.confirmed })}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : value.mode === 'filter' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('emailBroadcastGroups')}</legend>
            <Text className="text-xs">{t('emailBroadcastGroupsHint')}</Text>
            {groupsError ? (
              <Text className="text-xs text-destructive">{t('emailBroadcastGroupsError')}</Text>
            ) : !groups ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : groups.length === 0 ? (
              <Text className="text-xs">{t('emailBroadcastNoGroups')}</Text>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={value.group_ids.includes(group.id)}
                      onChange={() => set({ group_ids: toggle(value.group_ids, group.id) })}
                    />
                    <span>{group.display_name}</span>
                    <span className="text-xs text-muted-foreground">{group.user_count}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('emailBroadcastRoles')}</legend>
              <Text className="text-xs">{t('emailBroadcastRolesHint')}</Text>
              <div className="flex flex-wrap gap-4">
                {BROADCAST_ROLES.map((role: BroadcastRole) => (
                  <label
                    key={role}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={value.roles.includes(role)}
                      onChange={() => set({ roles: toggle(value.roles, role) })}
                    />
                    {t(`emailBroadcastRole_${role}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label>{t('emailBroadcastAccess')}</Label>
              <div>
                <SegmentedControl
                  label={t('emailBroadcastAccess')}
                  value={value.access}
                  options={BROADCAST_ACCESS.map((access) => ({
                    value: access,
                    label: t(`emailBroadcastAccess_${access}`),
                  }))}
                  onChange={(access) => set({ access })}
                />
              </div>
            </div>

            {DATE_FIELDS.map(([after, before, labelKey]) => (
              <fieldset
                key={after}
                className="space-y-2"
              >
                <legend className="text-sm font-medium">{t(labelKey)}</legend>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('emailBroadcastAfter')}</span>
                  <Input
                    type="date"
                    className="w-40"
                    aria-label={`${t(labelKey)} ${t('emailBroadcastAfter')}`}
                    value={value[after]}
                    onChange={(ev) => set({ [after]: ev.target.value })}
                  />
                  <span className="text-muted-foreground">{t('emailBroadcastBefore')}</span>
                  <Input
                    type="date"
                    className="w-40"
                    aria-label={`${t(labelKey)} ${t('emailBroadcastBefore')}`}
                    value={value[before]}
                    onChange={(ev) => set({ [before]: ev.target.value })}
                  />
                </div>
              </fieldset>
            ))}
            <Text className="text-xs">{t('emailBroadcastSeenHint')}</Text>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('emailBroadcastPickUsers')}</Label>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t('emailBroadcastSearchUsers')}
              label={t('emailBroadcastSearchUsers')}
            />
            {searching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            {results.length ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {results.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{userLabel(user)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={value.user_ids.includes(user.id)}
                      onClick={() => addUser(user)}
                    >
                      {t('emailBroadcastAdd')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {picked.length ? (
              <ul className="flex flex-wrap gap-2">
                {picked.map((user) => (
                  <li
                    key={user.id}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-xs"
                  >
                    {user.label}
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label={t('emailBroadcastRemove', { name: user.label })}
                      onClick={() =>
                        set({ user_ids: value.user_ids.filter((id) => id !== user.id) })
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="text-xs">{t('emailBroadcastNobodyPicked')}</Text>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-emails">{t('emailBroadcastPasteEmails')}</Label>
            <textarea
              id="broadcast-emails"
              className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={pasted}
              placeholder="ada@example.com, grace@example.com"
              onChange={(ev) => changePasted(ev.target.value)}
            />
            <Text className="text-xs">{t('emailBroadcastPasteHint')}</Text>
            {invalid.length ? (
              <Text className="text-xs text-destructive">
                {t('emailBroadcastInvalidEmails', { emails: invalid.slice(0, 5).join(', ') })}
              </Text>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
