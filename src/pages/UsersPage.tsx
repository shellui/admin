import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const MOCK_ROWS = [
  { id: 'usr_8f2a', email: 'ops@example.com', role: 'staff', status: 'active' },
  { id: 'usr_3c91', email: 'audit@example.com', role: 'read_only', status: 'active' },
  { id: 'usr_1b44', email: 'legacy@example.com', role: 'user', status: 'suspended' },
  { id: 'usr_9e0c', email: 'contractor@example.com', role: 'user', status: 'active' },
  { id: 'usr_7d33', email: 'root@example.com', role: 'staff', status: 'active' },
] as const;

const filterSchema = z.object({
  query: z.string(),
  scope: z.string(),
});

type FilterValues = z.infer<typeof filterSchema>;

export function UsersPage() {
  const { t } = useTranslation();

  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      query: '',
      scope: 'all',
    },
  });

  function onSubmit(_values: FilterValues) {
    /* scaffold: wire to API / search */
  }

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('usersTitle')}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {t('usersSchemaBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl font-mono">{t('usersDescription')}</Text>
      </header>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="font-heading text-lg">{t('usersTableTitle')}</CardTitle>
          <CardDescription className="font-mono text-xs">{t('usersTableDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wide">
                        {t('usersFieldQuery')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="font-mono text-sm"
                          placeholder={t('usersFieldQueryPlaceholder')}
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        {t('usersFieldQueryHint')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wide">
                        {t('usersFieldScope')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="font-mono text-sm"
                          placeholder={t('usersFieldScopePlaceholder')}
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        {t('usersFieldScopeHint')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" size="sm" className="font-mono text-xs">
                  {t('usersFormApply')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <Separator />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('usersColId')}
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('usersColEmail')}
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('usersColRole')}
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('usersColStatus')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs">
              {MOCK_ROWS.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{row.id}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{row.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {row.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === 'active' ? 'secondary' : 'muted'}
                      className="text-[10px]"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Text className="font-mono text-xs">{t('usersUiHint')}</Text>
    </div>
  );
}
