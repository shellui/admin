import { describe, expect, it } from 'vitest';
import { auditSvgMarkupLightVisibility } from '@/lib/oauthIconLightVisibility';

describe('auditSvgMarkupLightVisibility', () => {
  it('fails white-only marks without a background', () => {
    const audit = auditSvgMarkupLightVisibility(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#fff" d="M0 0h10v10H0z"/></svg>',
    );
    expect(audit.ok).toBe(false);
  });

  it('passes white foreground on a colored tile', () => {
    const audit = auditSvgMarkupLightVisibility(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#635BFF" width="10" height="10"/><path fill="#FFFFFF" d="M2 2h6v6H2z"/></svg>',
    );
    expect(audit.ok).toBe(true);
  });
});
