import { describe, expect, it } from 'vitest';
import { fillSampleData, sampleValues } from '@/lib/emailSampleData';

const values = sampleValues([
  {
    token: 'app_url',
    type: 'url',
    required: true,
    description: '',
    example: 'https://app.shellui.com/?a=1&b=2',
    isUrl: true,
  },
  { token: 'empty', type: 'string', required: false, description: '', example: '', isUrl: false },
]);

describe('fillSampleData', () => {
  it('fills rendered HTML, including defaults written with HTML quotes', () => {
    const html =
      '<a href="{{ app_url }}">{{ name|default:&quot;you &amp; me&quot; }}</a> {{ system.message_id }} {{ empty }}';
    expect(fillSampleData(html, values, { html: true })).toBe(
      '<a href="https://app.shellui.com/?a=1&amp;b=2">you &amp; me</a> msg_test {{ empty }}',
    );
  });

  it('fills plain text without escaping', () => {
    expect(
      fillSampleData('Open {{ app_url }} {{ name|default:"<friend>" }}', values, { html: false }),
    ).toBe('Open https://app.shellui.com/?a=1&b=2 <friend>');
  });
});
