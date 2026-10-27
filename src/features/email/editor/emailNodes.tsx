import type { CSSProperties, ReactNode } from 'react';
import { Extension, type Extensions, type NodeConfig } from '@tiptap/core';
import { Body, Container as EmailContainer, Head, Html, Img, Link, Preview } from 'react-email';
import { EmailNode } from '@react-email/editor/core';
import { Container as BaseContainer, StarterKit } from '@react-email/editor/extensions';
import { TextIdAttribute } from '@/features/email/editor/textIds';

/*
 * Same node set as email-service `renderer/editor.mjs`, so a document composes
 * to the same HTML in the preview and in the stored version.
 */

export function cssToJs(css: unknown): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of String(css || '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 1) continue;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!name || !value) continue;
    style[
      name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    ] = value;
  }
  return style as CSSProperties;
}

function stringAttr(value: unknown): string | undefined {
  return typeof value === 'string' && value && value !== 'auto' ? value : undefined;
}

function sizeAttr(value: unknown): string | number | undefined {
  return typeof value === 'number' ? value : stringAttr(value);
}

/** React Email images are blocks, so auto margins place them. */
export function imageAlignStyle(alignment: unknown): CSSProperties {
  if (alignment === 'center') return { marginLeft: 'auto', marginRight: 'auto' };
  if (alignment === 'right') return { marginLeft: 'auto', marginRight: 0 };
  return {};
}

export const EmailImage = EmailNode.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      width: { default: 'auto' },
      height: { default: 'auto' },
      href: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) => ({
          href: (element as HTMLElement).closest('a[href]')?.getAttribute('href') ?? null,
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes];
  },
  renderToReactEmail({ node, style }) {
    const attrs = node.attrs ?? {};
    if (typeof attrs.src !== 'string' || !attrs.src) return null;
    const img = (
      <Img
        alt={typeof attrs.alt === 'string' ? attrs.alt : ''}
        className={stringAttr(attrs.class)}
        height={sizeAttr(attrs.height)}
        src={attrs.src}
        style={{ ...style, ...cssToJs(attrs.style), ...imageAlignStyle(attrs.alignment) }}
        width={sizeAttr(attrs.width)}
      />
    );
    return typeof attrs.href === 'string' && attrs.href ? (
      <Link href={attrs.href}>{img}</Link>
    ) : (
      img
    );
  },
});

type NodeRenderer = Parameters<typeof EmailNode.from>[1];
type ContainerOptions =
  typeof BaseContainer extends EmailNode<infer O, Record<string, never>> ? O : never;
interface LayoutContainerConfig extends NodeConfig<ContainerOptions, Record<string, never>> {
  renderToReactEmail: NodeRenderer;
}

// The stock container drops its inline style, which carries the design's max width.
export const EmailLayoutContainer = BaseContainer.extend<
  ContainerOptions,
  Record<string, never>,
  LayoutContainerConfig
>({
  addAttributes() {
    return {
      style: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('style') || '',
      },
      class: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('class') || '',
      },
    };
  },
  renderToReactEmail({ children, node }) {
    return (
      <EmailContainer
        className={stringAttr(node.attrs?.class)}
        style={cssToJs(node.attrs?.style)}
      >
        {children}
      </EmailContainer>
    );
  },
});

// Apple Mail turns dates, phones, and domains into blue links. Keep them in the text's color.
export const DATA_DETECTORS =
  'a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}';

const BACKGROUND = /(?:^|;)\s*background-color\s*:\s*([^;]+)/i;
const COLOR = /(?:^|;)\s*color\s*:\s*([^;]+)/i;

type StyledNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: StyledNode[];
};

function styleOf(attrs?: Record<string, unknown>): string {
  return typeof attrs?.style === 'string' ? attrs.style : '';
}

/** The design's page color: the first table cell reached through the document's leading blocks. */
export function pageBackground(document: StyledNode | undefined): string {
  let node = document?.content?.[0];
  while (node) {
    if (node.type === 'tableCell') return styleOf(node.attrs).match(BACKGROUND)?.[1].trim() || '';
    if (!['container', 'table', 'tableRow'].includes(node.type ?? '')) return '';
    node = node.content?.[0];
  }
  return '';
}

/** Links without a color of their own take the surrounding text color, not React Email's default blue. */
export function inheritLinkColors<T extends StyledNode>(node: T, color = ''): T {
  const current = styleOf(node.attrs).match(COLOR)?.[1].trim() || color;
  for (const mark of node.marks ?? []) {
    const style = styleOf(mark.attrs);
    if (mark.type === 'link' && current && !COLOR.test(style)) {
      mark.attrs = {
        ...mark.attrs,
        style: style ? `color:${current};${style}` : `color:${current}`,
      };
    }
  }
  for (const child of node.content ?? []) inheritLinkColors(child, current);
  return node;
}

function EmailDocumentTemplate({
  children,
  previewText,
  head,
  page,
}: {
  children?: ReactNode;
  previewText?: string;
  head: string;
  page: string;
}) {
  // The page color goes on html, body, and the body table too, so it fills the whole
  // window instead of stopping at the content, and clients that drop body styles keep it.
  const pageStyle: CSSProperties = page ? { backgroundColor: page } : {};
  return (
    <Html style={pageStyle}>
      <Head>
        <meta
          content="width=device-width"
          name="viewport"
        />
        <meta name="x-apple-disable-message-reformatting" />
        <style
          dangerouslySetInnerHTML={{ __html: [DATA_DETECTORS, head].filter(Boolean).join('\n') }}
        />
      </Head>
      <Body
        style={
          page
            ? { margin: 0, ...pageStyle, minHeight: '100%', paddingBottom: '2rem' }
            : { margin: 0 }
        }
      >
        {previewText ? <Preview>{previewText}</Preview> : null}
        {children}
      </Body>
    </Html>
  );
}

function serializer(head: string, page: string) {
  return Extension.create({
    name: 'shelluiSerializer',
    addOptions() {
      return {
        serializerPlugin: {
          getNodeStyles: () => ({}),
          BaseTemplate: (props: { children?: ReactNode; previewText?: string }) => (
            <EmailDocumentTemplate
              {...props}
              head={head}
              page={page}
            />
          ),
        },
      };
    },
  });
}

/** Nodes, marks, and the serializer a stored document needs. */
export function emailDocumentExtensions(head = '', page = ''): Extensions {
  return [
    StarterKit.configure({ Container: false }),
    EmailLayoutContainer,
    EmailImage,
    TextIdAttribute,
    serializer(head, page),
  ];
}
