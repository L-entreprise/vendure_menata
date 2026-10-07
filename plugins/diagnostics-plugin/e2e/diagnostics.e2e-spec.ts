import http from 'node:http';
import { AddressInfo } from 'node:net';

import { gql } from 'graphql-tag';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { DiagnosticsPlugin } from '../diagnostics.plugin';
import { DiagnosticsService } from '../services/diagnostics.service';
import { DiagnosticsPluginOptions } from '../types';

const DIAGNOSTIC = gql`
    query {
        diagnostic {
            available
            expired
            title
            html
            validUntil
            ctaUrl
        }
    }
`;

type MockReply = { status: number; body?: unknown; delayMs?: number };

/** Stands in for the Menata `POST /api/client/diagnostic` endpoint. */
function startMenataMock() {
    const requests: Array<{ authorization?: string; body: any }> = [];
    let reply: MockReply = { status: 200, body: {} };
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => {
            requests.push({ authorization: req.headers.authorization, body: JSON.parse(raw || '{}') });
            setTimeout(() => {
                res.writeHead(reply.status, { 'content-type': 'application/json' });
                res.end(JSON.stringify(reply.body ?? {}));
            }, reply.delayMs ?? 0);
        });
    });
    return {
        server,
        requests,
        respondWith: (next: MockReply) => (reply = next),
        listen: () =>
            new Promise<string>(resolve =>
                server.listen(0, '127.0.0.1', () =>
                    resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
                ),
            ),
    };
}

describe('DiagnosticsPlugin', () => {
    const menata = startMenataMock();
    // Filled with the mock's address before the server boots; the plugin reads it at DI time.
    const options: DiagnosticsPluginOptions = {
        apiBaseUrl: '',
        apiKey: 'client-key',
        clientId: 'client-42',
        ctaUrl: 'https://menata.fr/diagnostic',
        cacheTtlMs: 0,
        requestTimeoutMs: 300,
    };
    const { server, adminClient } = createPluginTestEnvironment({
        plugins: [DiagnosticsPlugin.init(options)],
    });

    beforeAll(async () => {
        options.apiBaseUrl = await menata.listen();
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
        menata.server.close();
    });

    beforeEach(() => {
        menata.requests.length = 0;
    });

    it('returns a valid diagnostic and authenticates server-to-server', async () => {
        menata.respondWith({
            status: 200,
            body: { title: 'Audit 2026', html: '<h1>Score</h1>', validUntil: 1893456000 },
        });

        const { diagnostic } = await adminClient.query(DIAGNOSTIC);

        expect(diagnostic).toEqual({
            available: true,
            expired: false,
            title: 'Audit 2026',
            html: '<h1>Score</h1>',
            validUntil: '2030-01-01T00:00:00.000Z',
            ctaUrl: 'https://menata.fr/diagnostic',
        });
        expect(menata.requests[0]).toEqual({
            authorization: 'Bearer client-key',
            body: { clientId: 'client-42' },
        });
    });

    it('reports an expired diagnostic without its html', async () => {
        menata.respondWith({ status: 200, body: { title: 'Old', expired: true } });

        const { diagnostic } = await adminClient.query(DIAGNOSTIC);

        expect(diagnostic).toMatchObject({ available: false, expired: true, html: null });
    });

    it('degrades to the CTA when Menata errors', async () => {
        menata.respondWith({ status: 500 });

        const { diagnostic } = await adminClient.query(DIAGNOSTIC);

        expect(diagnostic).toMatchObject({ available: false, expired: false, ctaUrl: options.ctaUrl });
    });

    it('degrades to the CTA when Menata times out', async () => {
        menata.respondWith({ status: 200, body: { html: '<p>late</p>' }, delayMs: 1_000 });

        const { diagnostic } = await adminClient.query(DIAGNOSTIC);

        expect(diagnostic).toMatchObject({ available: false, html: null });
    });

    it('is not readable without being logged in', async () => {
        await adminClient.asAnonymousUser();
        await expect(adminClient.query(DIAGNOSTIC)).rejects.toThrow();
        await adminClient.asSuperAdmin();
    });

    it('caches the Menata response for the configured TTL', async () => {
        menata.respondWith({ status: 200, body: { html: '<p>cached</p>' } });
        const service = new DiagnosticsService({ ...options, cacheTtlMs: 60_000 });

        await service.getDiagnostic();
        await service.getDiagnostic();

        expect(menata.requests).toHaveLength(1);
    });
});
