import type { JSONContent } from '@tiptap/core';
import {
  blockRuns,
  runsPlainText,
  type EmailBlock,
  type EmailDocument,
  type EmailListItem,
  type EmailRun,
} from '@/lib/emailDocument';

type Marks = Pick<EmailRun, 'bold' | 'italic' | 'underline' | 'href'>;

function marksOf(node: JSONContent): Marks {
  const marks: Marks = {};
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') marks.bold = true;
    else if (mark.type === 'italic') marks.italic = true;
    else if (mark.type === 'underline') marks.underline = true;
    else if (
      mark.type === 'link' &&
      typeof mark.attrs?.href === 'string' &&
      mark.attrs.href.trim()
    ) {
      marks.href = mark.attrs.href.trim();
    }
  }
  return marks;
}

function sameMarks(a: Marks, b: Marks): boolean {
  return (
    a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.href === b.href
  );
}

function hasMarks(run: EmailRun): boolean {
  return Boolean(run.bold || run.italic || run.underline || run.href);
}

function inlineRuns(nodes: JSONContent[] | undefined): EmailRun[] {
  const runs: EmailRun[] = [];
  for (const node of nodes ?? []) {
    let run: EmailRun;
    if (node.type === 'text') run = { text: node.text ?? '', ...marksOf(node) };
    else if (node.type === 'hardBreak') run = { text: '\n' };
    else continue;
    if (!run.text) continue;
    const last = runs[runs.length - 1];
    if (last && (run.text === '\n' || sameMarks(last, run))) {
      last.text += run.text;
    } else {
      runs.push(run);
    }
  }
  return runs;
}

function textContent(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(textContent).join('');
}

function withRuns<T extends { text?: string; content?: EmailRun[] }>(base: T, runs: EmailRun[]): T {
  const text = runsPlainText(runs);
  if (!runs.some(hasMarks)) return { ...base, text };
  return { ...base, text, content: runs };
}

function listItems(list: JSONContent): EmailListItem[] {
  const items: EmailListItem[] = [];
  for (const item of list.content ?? []) {
    const runs: EmailRun[] = [];
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        if (runs.length) items.push(withRuns({ text: '' }, runs.splice(0)));
        items.push(...listItems(child));
        continue;
      }
      if (runs.length) runs.push({ text: '\n' });
      runs.push(...inlineRuns(child.content));
    }
    if (runs.some((run) => run.text.trim())) items.push(withRuns({ text: '' }, mergeRuns(runs)));
  }
  return items;
}

function mergeRuns(runs: EmailRun[]): EmailRun[] {
  const merged: EmailRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && (run.text === '\n' || sameMarks(last, run))) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

/** Editor JSON to the Shellui block document. Empty paragraphs are dropped. */
export function tiptapToDocument(json: JSONContent, preview: string): EmailDocument {
  const blocks: EmailBlock[] = [];
  const visit = (node: JSONContent) => {
    switch (node.type) {
      case 'heading':
      case 'paragraph':
      case 'footer': {
        const runs = inlineRuns(node.content);
        if (!runs.some((run) => run.text.trim())) return;
        const type: EmailBlock['type'] = node.type === 'paragraph' ? 'text' : node.type;
        blocks.push(withRuns<EmailBlock>({ type }, runs));
        return;
      }
      case 'button': {
        const href =
          typeof node.attrs?.href === 'string' && node.attrs.href !== '#' ? node.attrs.href : '';
        blocks.push({ type: 'button', text: textContent(node), href });
        return;
      }
      case 'bulletList':
      case 'orderedList': {
        const items = listItems(node);
        if (!items.length) return;
        blocks.push(
          node.type === 'orderedList'
            ? { type: 'list', ordered: true, items }
            : { type: 'list', items },
        );
        return;
      }
      case 'horizontalRule':
        blocks.push({ type: 'divider' });
        return;
      case 'doc':
      case 'container':
      case 'section':
      case 'div':
      case 'body':
        (node.content ?? []).forEach(visit);
        return;
      default: {
        const text = textContent(node);
        if (text.trim()) blocks.push({ type: 'text', text });
      }
    }
  };
  visit(json);
  return { preview, blocks };
}

function inlineNodes(runs: EmailRun[]): JSONContent[] {
  const nodes: JSONContent[] = [];
  for (const run of runs) {
    const marks: NonNullable<JSONContent['marks']> = [];
    if (run.bold) marks.push({ type: 'bold' });
    if (run.italic) marks.push({ type: 'italic' });
    if (run.underline) marks.push({ type: 'underline' });
    if (run.href) marks.push({ type: 'link', attrs: { href: run.href } });
    run.text.split('\n').forEach((line, index) => {
      if (index > 0) nodes.push({ type: 'hardBreak' });
      if (line)
        nodes.push(
          marks.length ? { type: 'text', text: line, marks } : { type: 'text', text: line },
        );
    });
  }
  return nodes;
}

function withContent(node: JSONContent, content: JSONContent[]): JSONContent {
  return content.length ? { ...node, content } : node;
}

/** The Shellui block document as editor JSON. */
export function documentToTiptap(document: EmailDocument): JSONContent {
  const content: JSONContent[] = [];
  for (const block of document.blocks) {
    switch (block.type) {
      case 'heading':
        content.push(
          withContent({ type: 'heading', attrs: { level: 1 } }, inlineNodes(blockRuns(block))),
        );
        break;
      case 'footer':
        content.push(withContent({ type: 'footer' }, inlineNodes(blockRuns(block))));
        break;
      case 'button':
        content.push(
          withContent(
            { type: 'button', attrs: { href: block.href ?? '' } },
            block.text ? [{ type: 'text', text: block.text }] : [],
          ),
        );
        break;
      case 'list':
        content.push({
          type: block.ordered ? 'orderedList' : 'bulletList',
          content: (block.items ?? []).map((item) => ({
            type: 'listItem',
            content: [withContent({ type: 'paragraph' }, inlineNodes(blockRuns(item)))],
          })),
        });
        break;
      case 'divider':
        content.push({ type: 'horizontalRule' });
        break;
      default:
        content.push(withContent({ type: 'paragraph' }, inlineNodes(blockRuns(block))));
    }
  }
  if (!content.length || content[content.length - 1].type !== 'paragraph') {
    content.push({ type: 'paragraph' });
  }
  return { type: 'doc', content };
}
