import { describe, expect, it } from 'vitest';
import { AGENT_CONNECT_ROUTE, agentConnectDrawerUrl } from './agentConnectDrawer';

describe('agentConnectDrawerUrl', () => {
  it('points at the connect hash route of this admin page', () => {
    expect(agentConnectDrawerUrl({ origin: 'https://admin.acme.com', pathname: '/' })).toBe(
      'https://admin.acme.com/#/agents/connect',
    );
    expect(AGENT_CONNECT_ROUTE).toBe('/agents/connect');
  });

  it('keeps a non-root pathname', () => {
    expect(agentConnectDrawerUrl({ origin: 'http://localhost:5173', pathname: '/admin/' })).toBe(
      'http://localhost:5173/admin/#/agents/connect',
    );
  });
});
