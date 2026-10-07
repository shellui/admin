import { describe, expect, it } from 'vitest';
import { scopeHeadCss } from '@/lib/emailHeadCss';

describe('scopeHeadCss', () => {
  it('limits global, body, and class rules to the scope', () => {
    const css = '* { font-family: Inter } body, html { margin: 0 } .title, h1 { color: red }';
    expect(scopeHeadCss(css, '.c').split('\n')).toEqual([
      '.c, .c *{ font-family: Inter }',
      '.c, .c{ margin: 0 }',
      '.c .title, .c h1{ color: red }',
    ]);
  });

  it('moves imports first and scopes rules inside media queries', () => {
    const css =
      '.a { color: red } @import url("https://fonts.example/css?family=A;B"); @media (max-width: 600px) { .a { width: 100% } }';
    expect(scopeHeadCss(css, '.c').split('\n')).toEqual([
      '@import url("https://fonts.example/css?family=A;B");',
      '.c .a{ color: red }',
      '@media (max-width: 600px){.c .a{ width: 100% }}',
    ]);
  });

  it('keeps other at-rules as written and ignores braces inside strings', () => {
    const css = "@font-face { font-family: X; src: url('x}.woff') } .q::before { content: '{' }";
    expect(scopeHeadCss(css, '.c').split('\n')).toEqual([
      "@font-face{ font-family: X; src: url('x}.woff') }",
      ".c .q::before{ content: '{' }",
    ]);
  });
});
