const URL_ID_REF = /url\(#([^)]+)\)/g;
const FRAGMENT_HREF_ATTR = /^#([^#].*)$/;

function isFragmentHrefAttributeName(name: string): boolean {
  return name === 'href' || name === 'xlink:href';
}

export function sanitizeSvgInstancePrefix(reactUseId: string): string {
  const trimmed = String(reactUseId || '').trim();
  const safe = trimmed.replace(/:/g, '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safe ? `i${safe}-` : 'i-';
}

function rewriteAttributeReferences(
  attrName: string,
  value: string,
  idMap: Map<string, string>,
): string {
  let next = value.replace(URL_ID_REF, (_match, id: string) => {
    const mapped = idMap.get(id);
    return mapped ? `url(#${mapped})` : _match;
  });
  if (isFragmentHrefAttributeName(attrName)) {
    const hrefMatch = next.match(FRAGMENT_HREF_ATTR);
    if (hrefMatch) {
      const mapped = idMap.get(hrefMatch[1]);
      if (mapped) next = `#${mapped}`;
    }
  }
  return next;
}

/** Prefix every id and in-document reference so multiple inline SVGs can coexist. */
export function prefixSvgDocumentIds(svgMarkup: string, prefix: string): string {
  if (!prefix || typeof DOMParser === 'undefined') return svgMarkup;
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') return svgMarkup;

  const idMap = new Map<string, string>();
  for (const el of root.querySelectorAll('[id]')) {
    const oldId = el.getAttribute('id');
    if (!oldId) continue;
    const newId = `${prefix}${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute('id', newId);
  }

  for (const el of root.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      const rewritten = rewriteAttributeReferences(attr.name, attr.value, idMap);
      if (rewritten !== attr.value) {
        el.setAttribute(attr.name, rewritten);
      }
    }
  }

  return new XMLSerializer().serializeToString(root);
}

export type SvgIdAuditResult = {
  ids: string[];
  duplicateIds: string[];
  brokenReferences: string[];
};

export function auditSvgMarkupIds(svgMarkup: string): SvgIdAuditResult {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  const ids: string[] = [];
  const idSet = new Set<string>();
  const duplicateIds: string[] = [];

  for (const el of root.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    if (!id) continue;
    ids.push(id);
    if (idSet.has(id)) duplicateIds.push(id);
    idSet.add(id);
  }

  const brokenReferences: string[] = [];
  for (const el of root.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value;
      for (const match of value.matchAll(URL_ID_REF)) {
        const ref = match[1];
        if (!idSet.has(ref)) brokenReferences.push(`${attr.name}=${value}`);
      }
      if (isFragmentHrefAttributeName(attr.name)) {
        const hrefMatch = value.match(FRAGMENT_HREF_ATTR);
        if (hrefMatch && !idSet.has(hrefMatch[1])) {
          brokenReferences.push(`${attr.name}=${value}`);
        }
      }
    }
  }

  return { ids, duplicateIds, brokenReferences };
}

export function auditInlineSvgTree(container: ParentNode): {
  duplicateIds: string[];
  brokenReferences: string[];
} {
  const svgs = container.querySelectorAll('svg');
  const globalIds = new Map<string, number>();
  const duplicateIds: string[] = [];
  const brokenReferences: string[] = [];

  for (const svg of svgs) {
    const localIds = new Set<string>();
    for (const el of svg.querySelectorAll('[id]')) {
      const id = el.getAttribute('id');
      if (!id) continue;
      localIds.add(id);
      globalIds.set(id, (globalIds.get(id) ?? 0) + 1);
      if (globalIds.get(id)! > 1) duplicateIds.push(id);
    }
    for (const el of svg.querySelectorAll('*')) {
      for (const attr of Array.from(el.attributes)) {
        for (const match of attr.value.matchAll(URL_ID_REF)) {
          if (!localIds.has(match[1])) brokenReferences.push(match[1]);
        }
        if (isFragmentHrefAttributeName(attr.name)) {
          const hrefMatch = attr.value.match(FRAGMENT_HREF_ATTR);
          if (hrefMatch && !localIds.has(hrefMatch[1])) brokenReferences.push(hrefMatch[1]);
        }
      }
    }
  }

  return {
    duplicateIds: [...new Set(duplicateIds)],
    brokenReferences: [...new Set(brokenReferences)],
  };
}
