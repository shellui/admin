import '@react-email/editor/themes/default.css';
import { EmailEditor, type EmailEditorRef } from '@react-email/editor';
import { Loader2 } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveEmailEditorContent, type ActionEmailLang } from '@/lib/actionEmailDefaults';
import { actionEmailThemeInput, type ActionEmailThemeChoice } from '@/lib/actionEmailTheme';
import type { ActionEmailDocument } from '@/features/actions/emailDocument';
import type { ActionEmailTemplate, ActionTemplateVariable } from '@/features/actions/types';
import { cn } from '@/lib/utils';

type LangTab = ActionEmailLang;

export type ReactEmailActionEditorHandle = {
  compileAll: () => Promise<{ en: ActionEmailTemplate; fr: ActionEmailTemplate }>;
};

type Props = {
  templateVariables?: ActionTemplateVariable[];
  valueEn: ActionEmailTemplate;
  valueFr: ActionEmailTemplate;
  onChangeEn: (next: ActionEmailTemplate) => void;
  onChangeFr: (next: ActionEmailTemplate) => void;
  contentRevision: number;
  disabled?: boolean;
  showResetToDefault?: boolean;
  resetLoading?: boolean;
  onResetToDefault?: () => void;
};

async function compileTemplate(
  ref: EmailEditorRef | null,
  subject: string,
): Promise<ActionEmailTemplate> {
  if (!ref) return { subject, html: '' };
  const document = ref.getJSON() as ActionEmailDocument;
  const html = await ref.getEmailHTML();
  return { subject, document, html };
}

function EmailEditorPane({
  lang,
  subject,
  template,
  onSubjectChange,
  onTemplateChange,
  templateVariables,
  themeInput,
  editorKey,
  disabled,
  editorRef,
}: {
  lang: LangTab;
  subject: string;
  template: ActionEmailTemplate;
  onSubjectChange: (subject: string) => void;
  onTemplateChange: (next: ActionEmailTemplate) => void;
  templateVariables?: ActionTemplateVariable[];
  themeInput: ReturnType<typeof actionEmailThemeInput>;
  editorKey: string;
  disabled?: boolean;
  editorRef: React.MutableRefObject<EmailEditorRef | null>;
}) {
  const { t } = useTranslation();
  const [previewHtml, setPreviewHtml] = useState('');
  const content = useMemo(() => resolveEmailEditorContent(template, lang), [lang, template]);

  const refreshPreview = useCallback(async (ref: EmailEditorRef | null) => {
    if (!ref) {
      setPreviewHtml('');
      return;
    }
    try {
      setPreviewHtml(await ref.getEmailHTML());
    } catch {
      setPreviewHtml('');
    }
  }, []);

  const syncTemplate = useCallback(
    async (ref: EmailEditorRef) => {
      const next = await compileTemplate(ref, subject);
      onTemplateChange(next);
      await refreshPreview(ref);
    },
    [onTemplateChange, refreshPreview, subject],
  );

  useEffect(() => {
    void refreshPreview(editorRef.current);
  }, [editorKey, editorRef, refreshPreview, themeInput]);

  const insertVariable = useCallback(
    (token: string) => {
      const editor = editorRef.current?.editor;
      if (!editor) return;
      editor.chain().focus().insertContent(`{{ ${token} }}`).run();
    },
    [editorRef],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailSubjectLabel', { lang })}
          </span>
          <Input
            value={subject}
            disabled={disabled}
            className="font-mono text-sm"
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        </label>

        {templateVariables?.length ? (
          <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('actionsEmailPlaceholders')}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {t('actionsEmailPlaceholdersHelp')}
            </p>
            <div className="flex flex-wrap gap-2">
              {templateVariables.map((v) => (
                <Button
                  key={v.token}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 font-mono text-[10px]"
                  disabled={disabled}
                  title={v.description ?? v.token}
                  onClick={() => insertVariable(v.token)}
                >
                  {`{{ ${v.token} }}`}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailDocumentLabel')}
          </p>
          <div
            className={cn(
              'min-h-[20rem] overflow-hidden rounded-md border border-border/80 bg-background',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            <EmailEditor
              key={editorKey}
              ref={editorRef}
              content={content}
              theme={themeInput}
              editable={!disabled}
              className="min-h-[20rem]"
              onReady={(ref) => {
                editorRef.current = ref;
                void syncTemplate(ref);
              }}
              onUpdate={(ref) => {
                editorRef.current = ref;
                void syncTemplate(ref);
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {t('actionsEmailPreview')}
        </p>
        <div className="overflow-hidden rounded-md border border-border/80 bg-muted/20">
          <iframe
            title={t('actionsEmailPreview')}
            className="h-[28rem] w-full bg-white"
            sandbox=""
            srcDoc={previewHtml || '<p></p>'}
          />
        </div>
        <Text className="font-mono text-[10px] text-muted-foreground">
          {t('actionsEmailPreviewHint')}
        </Text>
      </div>
    </div>
  );
}

export const ReactEmailActionEditor = forwardRef<ReactEmailActionEditorHandle, Props>(
  function ReactEmailActionEditor(
    {
      templateVariables,
      valueEn,
      valueFr,
      onChangeEn,
      onChangeFr,
      contentRevision,
      disabled,
      showResetToDefault,
      resetLoading,
      onResetToDefault,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const appearance = useTheme();
    const [tab, setTab] = useState<LangTab>('en');
    const [themeChoice, setThemeChoice] = useState<ActionEmailThemeChoice>('minimal');
    const enRef = useRef<EmailEditorRef | null>(null);
    const frRef = useRef<EmailEditorRef | null>(null);

    const themeInput = useMemo(
      () => actionEmailThemeInput(themeChoice, appearance),
      [appearance, themeChoice],
    );

    useImperativeHandle(
      ref,
      () => ({
        compileAll: async () => {
          const en = await compileTemplate(enRef.current, valueEn.subject);
          const fr = await compileTemplate(frRef.current, valueFr.subject);
          onChangeEn(en);
          onChangeFr(fr);
          return { en, fr };
        },
      }),
      [onChangeEn, onChangeFr, valueEn.subject, valueFr.subject],
    );

    const editorKeyEn = `en-${contentRevision}`;
    const editorKeyFr = `fr-${contentRevision}`;

    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="font-mono text-xs text-amber-950 dark:text-amber-100">
            {t('actionsEmailRebakeNotice')}
          </p>
          <p className="mt-1 font-mono text-[10px] text-amber-900/80 dark:text-amber-200/80">
            {t('actionsEmailSaveThemeHint')}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('actionsEmailThemeLabel')}
            </span>
            <select
              className="flex h-9 min-w-[12rem] rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm"
              value={themeChoice}
              disabled={disabled}
              onChange={(e) => setThemeChoice(e.target.value as ActionEmailThemeChoice)}
            >
              <option value="minimal">{t('actionsEmailThemeMinimal')}</option>
              <option value="basic">{t('actionsEmailThemeBasic')}</option>
              <option value="shellui">{t('actionsEmailThemeShellui')}</option>
            </select>
            <p className="max-w-md font-mono text-[10px] text-muted-foreground">
              {t('actionsEmailThemeHelp')}
            </p>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <LangTabs
            tab={tab}
            onTab={setTab}
          />
          {showResetToDefault && onResetToDefault ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || resetLoading}
              onClick={onResetToDefault}
            >
              {resetLoading ? (
                <>
                  <Loader2
                    className="mr-2 size-3.5 animate-spin"
                    aria-hidden
                  />
                  {t('actionsEmailResetLoading')}
                </>
              ) : (
                t('actionsEmailResetToDefault')
              )}
            </Button>
          ) : null}
        </div>

        <div className={tab === 'en' ? undefined : 'hidden'}>
          <EmailEditorPane
            lang="en"
            subject={valueEn.subject}
            template={valueEn}
            onSubjectChange={(subject) => onChangeEn({ ...valueEn, subject })}
            onTemplateChange={onChangeEn}
            templateVariables={templateVariables}
            themeInput={themeInput}
            editorKey={editorKeyEn}
            disabled={disabled}
            editorRef={enRef}
          />
        </div>
        <div className={tab === 'fr' ? undefined : 'hidden'}>
          <EmailEditorPane
            lang="fr"
            subject={valueFr.subject}
            template={valueFr}
            onSubjectChange={(subject) => onChangeFr({ ...valueFr, subject })}
            onTemplateChange={onChangeFr}
            templateVariables={templateVariables}
            themeInput={themeInput}
            editorKey={editorKeyFr}
            disabled={disabled}
            editorRef={frRef}
          />
        </div>

        <Text className="font-mono text-[10px] text-muted-foreground">
          {t('actionsEmailEditorNote')}
        </Text>
      </div>
    );
  },
);

function LangTabs({ tab, onTab }: { tab: LangTab; onTab: (tab: LangTab) => void }) {
  return (
    <div className="flex gap-2">
      {(['en', 'fr'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          className={cn(
            'rounded-md px-3 py-1 font-mono text-xs uppercase',
            tab === lang ? 'bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted/50',
          )}
          onClick={() => onTab(lang)}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
