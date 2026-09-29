import type { ActionEmailDocument } from '@/features/actions/emailDocument';

function escapeJsxText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function pseudoJsxForNode(node: ActionEmailDocument, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const lines: string[] = [];

  if (node.type === 'text' && typeof node.text === 'string') {
    lines.push(`${pad}{\`${escapeJsxText(node.text)}\`}`);
    return lines;
  }

  const children = (node.content ?? []).flatMap((child) => pseudoJsxForNode(child, depth + 1));
  const childBlock = children.length ? `\n${children.join('\n')}\n${pad}` : '';

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number | undefined) ?? 1;
      const tag = level <= 1 ? 'Heading' : level === 2 ? 'Heading' : 'Heading';
      const asProp = level > 1 ? ` as="h${level}"` : '';
      lines.push(`${pad}<${tag}${asProp}>${childBlock}</${tag}>`);
      return lines;
    }
    case 'paragraph':
      lines.push(`${pad}<Text>${childBlock}</Text>`);
      return lines;
    case 'bulletList':
      lines.push(`${pad}<ul>${childBlock}</ul>`);
      return lines;
    case 'orderedList':
      lines.push(`${pad}<ol>${childBlock}</ol>`);
      return lines;
    case 'listItem':
      lines.push(`${pad}<li>${childBlock}</li>`);
      return lines;
    case 'button':
      lines.push(`${pad}<Button href="…">${childBlock}</Button>`);
      return lines;
    case 'link':
    case 'textStyle':
      lines.push(`${pad}<Link>${childBlock}</Link>`);
      return lines;
    case 'hardBreak':
      lines.push(`${pad}<br />`);
      return lines;
    case 'horizontalRule':
      lines.push(`${pad}<Hr />`);
      return lines;
    case 'image':
      lines.push(`${pad}<Img src="…" alt="" />`);
      return lines;
    default:
      if (children.length) {
        lines.push(`${pad}<${node.type}>${childBlock}</${node.type}>`);
      } else {
        lines.push(`${pad}{/* ${node.type} */}`);
      }
      return lines;
  }
}

/** Read-only pseudo-TSX for debugging; not executable and not a round-trip format. */
export function formatDocumentAsReactDebugSource(
  document: ActionEmailDocument | undefined,
): string {
  const doc =
    document?.type === 'doc' ? document : { type: 'doc', content: [] as ActionEmailDocument[] };
  const body = (doc.content ?? []).flatMap((node) => pseudoJsxForNode(node, 2));
  return [
    '// Read-only debug view derived from React Email document JSON.',
    '// Edit JSON mode to change what identity stores. TSX is not saved or executed.',
    '',
    'import { Body, Button, Container, Head, Heading, Html, Link, Text } from "@react-email/components";',
    '',
    'export default function ActionEmailDebugView() {',
    '  return (',
    '    <Html>',
    '      <Head />',
    '      <Body>',
    '        <Container>',
    ...body,
    '        </Container>',
    '      </Body>',
    '    </Html>',
    '  );',
    '}',
  ].join('\n');
}
