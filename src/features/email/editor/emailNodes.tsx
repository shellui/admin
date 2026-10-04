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

function EmailDocumentTemplate({
  children,
  previewText,
  head,
}: {
  children?: ReactNode;
  previewText?: string;
  head: string;
}) {
  return (
    <Html>
      <Head>
        <meta
          content="width=device-width"
          name="viewport"
        />
        <meta name="x-apple-disable-message-reformatting" />
        {head ? <style dangerouslySetInnerHTML={{ __html: head }} /> : null}
      </Head>
      <Body style={{ margin: 0 }}>
        {previewText ? <Preview>{previewText}</Preview> : null}
        {children}
      </Body>
    </Html>
  );
}

function serializer(head: string) {
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
            />
          ),
        },
      };
    },
  });
}

/** Nodes, marks, and the serializer a stored document needs. */
export function emailDocumentExtensions(head = ''): Extensions {
  return [
    StarterKit.configure({ Container: false }),
    EmailLayoutContainer,
    EmailImage,
    TextIdAttribute,
    serializer(head),
  ];
}
