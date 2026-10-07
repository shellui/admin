type Rule = { prelude: string; body: string | null };

/** Top-level rules. `body` is null for statements such as `@import …;`. */
function topLevelRules(css: string): Rule[] {
  const rules: Rule[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  let open = -1;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (quote) {
      if (char === quote && css[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '{') {
      if (depth === 0) open = index;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        rules.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, index) });
        start = index + 1;
      }
    } else if (char === ';' && depth === 0) {
      const prelude = css.slice(start, index).trim();
      if (prelude) rules.push({ prelude, body: null });
      start = index + 1;
    }
  }
  return rules;
}

function scopeSelector(selector: string, scope: string): string {
  const trimmed = selector.trim();
  if (trimmed === '*') return `${scope}, ${scope} *`;
  if (/^(html|body)\b/.test(trimmed)) return trimmed.replace(/^(html|body)\b/, scope);
  return `${scope} ${trimmed}`;
}

/**
 * The design's head CSS limited to `scope`, so its `* { font-family }` and
 * mobile rules style the editor canvas and not the admin around it.
 */
export function scopeHeadCss(css: string, scope: string): string {
  const out: string[] = [];
  for (const rule of topLevelRules(css)) {
    if (rule.body === null) {
      if (/^@import\b/i.test(rule.prelude)) out.unshift(`${rule.prelude};`);
      continue;
    }
    if (/^@media\b/i.test(rule.prelude)) {
      out.push(`${rule.prelude}{${scopeHeadCss(rule.body, scope)}}`);
    } else if (rule.prelude.startsWith('@')) {
      out.push(`${rule.prelude}{${rule.body}}`);
    } else {
      const selectors = rule.prelude.split(',').map((item) => scopeSelector(item, scope));
      out.push(`${selectors.join(', ')}{${rule.body}}`);
    }
  }
  return out.join('\n');
}
