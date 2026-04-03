import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchAdminGroups, type AdminGroupRow } from '@/lib/adminGroupsApi';
import { fetchAdminUser, updateAdminUser } from '@/lib/adminUsersApi';

const editSchema = z.object({
  first_name: z.string().max(150),
  last_name: z.string().max(150),
  is_staff: z.boolean(),
  is_active: z.boolean(),
});

type EditValues = z.infer<typeof editSchema>;

export function UserEditPage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const idNum = userId ? parseInt(userId, 10) : NaN;

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [emailReadonly, setEmailReadonly] = useState('');
  const [usernameReadonly, setUsernameReadonly] = useState('');
  const [allGroups, setAllGroups] = useState<AdminGroupRow[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      is_staff: false,
      is_active: true,
    },
  });

  const { reset: resetForm } = form;

  useEffect(() => {
    if (!accessToken || !Number.isFinite(idNum)) {
      setLoadingUser(false);
      return;
    }

    let cancelled = false;
    setLoadingUser(true);
    setLoadError(null);
    void Promise.all([fetchAdminUser(accessToken, idNum), fetchAdminGroups(accessToken)])
      .then(([user, groups]) => {
        if (cancelled) return;
        setEmailReadonly(user.email);
        setUsernameReadonly(user.username);
        setAllGroups(groups);
        setSelectedGroupIds((user.groups ?? []).map((g) => g.id));
        resetForm({
          first_name: user.first_name ?? '',
          last_name: user.last_name ?? '',
          is_staff: user.is_staff,
          is_active: user.is_active,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t('usersErrorUnknown'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, idNum, resetForm, t]);

  async function onSubmit(values: EditValues) {
    if (!accessToken || !Number.isFinite(idNum)) return;
    form.clearErrors('root');
    try {
      await updateAdminUser(accessToken, idNum, {
        first_name: values.first_name,
        last_name: values.last_name,
        is_staff: values.is_staff,
        is_active: values.is_active,
        group_ids: selectedGroupIds,
      });
      shellui.toast({ title: t('userEditSaved'), type: 'success' });
      navigate(-1);
    } catch (e) {
      form.setError('root', {
        message: e instanceof Error ? e.message : t('usersErrorUnknown'),
      });
    }
  }

  if (!Number.isFinite(idNum)) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{t('userEditInvalidId')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => navigate(-1)}>
          {t('userEditBack')}
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t('userEditTitle')}</h1>
      </header>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('userEditCardTitle')}</CardTitle>
          <CardDescription>{t('userEditCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!accessToken ? (
            <Text className="text-sm text-muted-foreground">{t('usersNoSession')}</Text>
          ) : loadError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </p>
          ) : loadingUser ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span className="text-sm">{t('userEditLoading')}</span>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {form.formState.errors.root ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <FormLabel className="text-xs text-muted-foreground">{t('userEditEmail')}</FormLabel>
                  <Input className="bg-muted/50" disabled value={emailReadonly} readOnly />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-xs text-muted-foreground">{t('userEditUsername')}</FormLabel>
                  <Input className="bg-muted/50" disabled value={usernameReadonly} readOnly />
                </div>
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('userEditFirstName')}</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('userEditLastName')}</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_staff"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="mt-1 size-4 rounded border"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('userEditStaff')}</FormLabel>
                        <FormDescription className="text-xs">{t('userEditStaffHint')}</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="mt-1 size-4 rounded border"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('userEditActive')}</FormLabel>
                        <FormDescription className="text-xs">{t('userEditActiveHint')}</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="space-y-2 rounded-md border p-3">
                  <FormLabel>{t('userEditGroups')}</FormLabel>
                  <FormDescription className="text-xs">{t('userEditGroupsHint')}</FormDescription>
                  {allGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('userEditGroupsEmpty')}</p>
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-auto pr-1">
                      {allGroups.map((g) => {
                        const checked = selectedGroupIds.includes(g.id);
                        return (
                          <li key={g.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`group-${g.id}`}
                              className="size-4 rounded border"
                              checked={checked}
                              onChange={() => {
                                setSelectedGroupIds((prev) =>
                                  checked ? prev.filter((id) => id !== g.id) : [...prev, g.id],
                                );
                              }}
                            />
                            <label htmlFor={`group-${g.id}`} className="cursor-pointer text-sm">
                              {g.name}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={form.formState.isSubmitting} className="inline-flex items-center gap-2">
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('userEditSaving')}
                      </>
                    ) : (
                      t('userEditSave')
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    {t('userEditCancel')}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
