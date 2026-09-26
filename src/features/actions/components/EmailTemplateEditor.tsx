import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { exportEditorHtmlToStandaloneDocument } from '@/lib/emailHtmlExport';
import {
  buildCtaButtonHtml,
  buildTextLinkInlineStyle,
  DEFAULT_EMAIL_STYLE,
  normalizeHexColor,
  updateCtaButtonStylesInHtml,
  type EmailStylePrefs,
} from '@/lib/emailStyle';
import type { ActionEmailTemplate, ActionTemplateVariable } from '@/features/actions/types';
import { cn } from '@/lib/utils';

type LangTab = 'en' | 'fr';

type Props = {
  templateVariables?: ActionTemplateVariable[];
  valueEn: ActionEmailTemplate;
  valueFr: ActionEmailTemplate;
  onChangeEn: (next: ActionEmailTemplate) => void;
  onChangeFr: (next: ActionEmailTemplate) => void;
  disabled?: boolean;
  showResetToDefault?: boolean;
  resetLoading?: boolean;
  onResetToDefault?: () => void;
};

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        'rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wide',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/70',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EmailStyleStrip({
  stylePrefs,
  onChange,
  onApplyToButtons,
  disabled,
}: {
  stylePrefs: EmailStylePrefs;
  onChange: (next: EmailStylePrefs) => void;
  onApplyToButtons: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const patch = (partial: Partial<EmailStylePrefs>) => onChange({ ...stylePrefs, ...partial });

  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-muted/20 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {t('actionsEmailStyleTitle')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailStyleBrandColor')}
          </span>
          <div className="flex gap-2">
            <input
              type="color"
              value={stylePrefs.brandColor}
              disabled={disabled}
              className="h-9 w-10 cursor-pointer rounded border border-input"
              onChange={(e) =>
                patch({ brandColor: normalizeHexColor(e.target.value, stylePrefs.brandColor) })
              }
            />
            <Input
              value={stylePrefs.brandColor}
              disabled={disabled}
              className="font-mono text-xs"
              onChange={(e) =>
                patch({ brandColor: normalizeHexColor(e.target.value, stylePrefs.brandColor) })
              }
            />
          </div>
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailStyleButtonText')}
          </span>
          <Input
            value={stylePrefs.buttonTextColor}
            disabled={disabled}
            className="font-mono text-xs"
            onChange={(e) =>
              patch({
                buttonTextColor: normalizeHexColor(e.target.value, stylePrefs.buttonTextColor),
              })
            }
          />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailStyleRadius')}
          </span>
          <Input
            type="number"
            min={0}
            max={24}
            value={stylePrefs.borderRadiusPx}
            disabled={disabled}
            className="font-mono text-xs"
            onChange={(e) =>
              patch({ borderRadiusPx: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })
            }
          />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailStyleWidth')}
          </span>
          <Input
            type="number"
            min={320}
            max={720}
            value={stylePrefs.contentWidthPx}
            disabled={disabled}
            className="font-mono text-xs"
            onChange={(e) =>
              patch({ contentWidthPx: Math.max(320, Number.parseInt(e.target.value, 10) || 560) })
            }
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailStylePageBg')}
          </span>
          <div className="flex gap-2">
            <input
              type="color"
              value={stylePrefs.pageBackground}
              disabled={disabled}
              className="h-9 w-10 cursor-pointer rounded border border-input"
              onChange={(e) =>
                patch({
                  pageBackground: normalizeHexColor(e.target.value, stylePrefs.pageBackground),
                })
              }
            />
            <Input
              value={stylePrefs.pageBackground}
              disabled={disabled}
              className="font-mono text-xs"
              onChange={(e) =>
                patch({
                  pageBackground: normalizeHexColor(e.target.value, stylePrefs.pageBackground),
                })
              }
            />
          </div>
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailStyleLayout')}
          </span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs"
            value={stylePrefs.layout}
            disabled={disabled}
            onChange={(e) => patch({ layout: e.target.value as EmailStylePrefs['layout'] })}
          >
            <option value="flat">{t('actionsEmailStyleLayoutFlat')}</option>
            <option value="card">{t('actionsEmailStyleLayoutCard')}</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={stylePrefs.linkUsesBrandColor}
          disabled={disabled}
          onChange={(e) => patch({ linkUsesBrandColor: e.target.checked })}
        />
        <span className="font-mono text-xs">{t('actionsEmailStyleLinkBrand')}</span>
      </label>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={onApplyToButtons}
      >
        {t('actionsEmailStyleApplyButtons')}
      </Button>
      <p className="font-mono text-[10px] text-muted-foreground">{t('actionsEmailStyleHint')}</p>
    </div>
  );
}

function EditorPane({
  lang,
  subject,
  bodyHtml,
  onSubjectChange,
  onBodyChange,
  templateVariables,
  emailStyle,
  disabled,
}: {
  lang: LangTab;
  subject: string;
  bodyHtml: string;
  onSubjectChange: (v: string) => void;
  onBodyChange: (html: string) => void;
  templateVariables?: ActionTemplateVariable[];
  emailStyle: EmailStylePrefs;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
    ],
    content: bodyHtml || '<p></p>',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onBodyChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (bodyHtml !== current) {
      editor.commands.setContent(bodyHtml || '<p></p>', { emitUpdate: false });
    }
  }, [bodyHtml, editor, lang]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const previewDoc = useMemo(
    () =>
      exportEditorHtmlToStandaloneDocument(bodyHtml, {
        pageBackground: emailStyle.pageBackground,
        contentWidthPx: emailStyle.contentWidthPx,
        layout: emailStyle.layout,
      }),
    [bodyHtml, emailStyle.contentWidthPx, emailStyle.layout, emailStyle.pageBackground],
  );

  const insertVar = useCallback(
    (token: string) => {
      editor?.chain().focus().insertContent(`{{ ${token} }}`).run();
    },
    [editor],
  );

  const linkStyle = emailStyle.linkUsesBrandColor ? buildTextLinkInlineStyle(emailStyle) : '';

  const insertVarAsLink = useCallback(
    (token: string) => {
      const href = `{{ ${token} }}`;
      const styleAttr = linkStyle ? ` style="${linkStyle}"` : '';
      editor
        ?.chain()
        .focus()
        .insertContent(`<p><a href="${href}"${styleAttr}>${href}</a></p>`)
        .run();
    },
    [editor, linkStyle],
  );

  const insertVarAsButton = useCallback(
    (token: string) => {
      const href = `{{ ${token} }}`;
      const label = t('actionsEmailButtonDefaultLabel');
      editor
        ?.chain()
        .focus()
        .insertContent(buildCtaButtonHtml(href, label, emailStyle))
        .run();
    },
    [editor, emailStyle, t],
  );

  const setLink = useCallback(() => {
    const prev = editor?.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('actionsEmailLinkPrompt'), prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (emailStyle.linkUsesBrandColor) {
      editor
        ?.chain()
        .focus()
        .insertContent(
          `<a href="${url}" style="${buildTextLinkInlineStyle(emailStyle)}">${url}</a>`,
        )
        .run();
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, emailStyle, t]);

  const insertButtonLink = useCallback(() => {
    const url = window.prompt(t('actionsEmailButtonUrlPrompt'), 'https://');
    if (!url) return;
    const label = window.prompt(
      t('actionsEmailButtonLabelPrompt'),
      t('actionsEmailButtonDefaultLabel'),
    );
    const text = label?.trim() || t('actionsEmailButtonDefaultLabel');
    editor
      ?.chain()
      .focus()
      .insertContent(buildCtaButtonHtml(url, text, emailStyle))
      .run();
  }, [editor, emailStyle, t]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailSubjectLabel', { lang: lang.toUpperCase() })}
          </label>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="font-mono text-sm"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2 rounded-md border border-border/80">
          <div className="flex flex-wrap gap-1 border-b border-border/60 p-2">
            <ToolbarButton
              title={t('actionsEmailToolBold')}
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              B
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolItalic')}
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              I
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolH1')}
              active={editor?.isActive('heading', { level: 1 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              H1
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolH2')}
              active={editor?.isActive('heading', { level: 2 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolBullet')}
              active={editor?.isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              UL
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolOrdered')}
              active={editor?.isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              OL
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolLink')}
              active={editor?.isActive('link')}
              onClick={() => setLink()}
            >
              Link
            </ToolbarButton>
            <ToolbarButton
              title={t('actionsEmailToolButton')}
              onClick={() => insertButtonLink()}
            >
              Btn
            </ToolbarButton>
          </div>
          <EditorContent
            editor={editor}
            className="max-w-none min-h-[12rem] px-3 py-2 font-mono text-sm [&_.ProseMirror]:min-h-[12rem] [&_.ProseMirror]:outline-none"
          />
        </div>
        {templateVariables && templateVariables.length > 0 ? (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('actionsEmailPlaceholders')}
            </p>
            <div className="flex flex-wrap gap-2">
              {templateVariables.map((v) => (
                <div
                  key={v.token}
                  className="inline-flex flex-wrap items-center gap-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 font-mono text-[10px]"
                    disabled={disabled}
                    title={v.description || v.token}
                    onClick={() => insertVar(v.token)}
                  >
                    {`{{ ${v.token} }}`}
                  </Button>
                  {v.isUrl ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 font-mono text-[10px]"
                        disabled={disabled}
                        title={t('actionsEmailInsertVarAsLink', { var: v.token })}
                        onClick={() => insertVarAsLink(v.token)}
                      >
                        {t('actionsEmailInsertLinkShort')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 font-mono text-[10px]"
                        disabled={disabled}
                        title={t('actionsEmailInsertVarAsButton', { var: v.token })}
                        onClick={() => insertVarAsButton(v.token)}
                      >
                        {t('actionsEmailInsertButtonShort')}
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {t('actionsEmailPreview')}
        </p>
        <div className="overflow-hidden rounded-md border border-border/80 bg-muted/20">
          <iframe
            title={t('actionsEmailPreview')}
            className="h-[22rem] w-full bg-white"
            sandbox=""
            srcDoc={previewDoc}
          />
        </div>
        <Text className="font-mono text-[10px] text-muted-foreground">
          {t('actionsEmailPreviewHint')}
        </Text>
      </div>
    </div>
  );
}

export function EmailTemplateEditor({
  templateVariables,
  valueEn,
  valueFr,
  onChangeEn,
  onChangeFr,
  disabled,
  showResetToDefault,
  resetLoading,
  onResetToDefault,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LangTab>('en');
  const [emailStyle, setEmailStyle] = useState<EmailStylePrefs>(DEFAULT_EMAIL_STYLE);

  const applyBrandToButtons = useCallback(() => {
    onChangeEn({
      ...valueEn,
      body_html: updateCtaButtonStylesInHtml(valueEn.body_html, emailStyle),
    });
    onChangeFr({
      ...valueFr,
      body_html: updateCtaButtonStylesInHtml(valueFr.body_html, emailStyle),
    });
  }, [emailStyle, onChangeEn, onChangeFr, valueEn, valueFr]);

  return (
    <div className="space-y-4">
      <EmailStyleStrip
        stylePrefs={emailStyle}
        onChange={setEmailStyle}
        onApplyToButtons={applyBrandToButtons}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(['en', 'fr'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={cn(
                'rounded-md px-3 py-1 font-mono text-xs uppercase',
                tab === lang ? 'bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted/50',
              )}
              onClick={() => setTab(lang)}
            >
              {lang}
            </button>
          ))}
        </div>
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
      {tab === 'en' ? (
        <EditorPane
          lang="en"
          subject={valueEn.subject}
          bodyHtml={valueEn.body_html}
          onSubjectChange={(subject) => onChangeEn({ ...valueEn, subject })}
          onBodyChange={(body_html) => onChangeEn({ ...valueEn, body_html })}
          templateVariables={templateVariables}
          emailStyle={emailStyle}
          disabled={disabled}
        />
      ) : (
        <EditorPane
          lang="fr"
          subject={valueFr.subject}
          bodyHtml={valueFr.body_html}
          onSubjectChange={(subject) => onChangeFr({ ...valueFr, subject })}
          onBodyChange={(body_html) => onChangeFr({ ...valueFr, body_html })}
          templateVariables={templateVariables}
          emailStyle={emailStyle}
          disabled={disabled}
        />
      )}
      <Text className="font-mono text-[10px] text-muted-foreground">
        {t('actionsEmailEditorNote')}
      </Text>
    </div>
  );
}
