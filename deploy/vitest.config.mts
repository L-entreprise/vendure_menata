import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig, Plugin } from 'vitest/config';

const deployDir = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.resolve(deployDir, '../plugins');

/**
 * The plugins live in ../plugins but their deps are installed here, in deploy/.
 * In Docker a /app/node_modules symlink bridges that gap. In a dev checkout the repo
 * root also has the monorepo's own node_modules, which Node would pick first and so
 * load a second copy of @vendure/core / typeorm next to @vendure/testing's one.
 * Resolving every bare import made from ../plugins as if it came from deploy/ keeps
 * a single copy of each package, in dev and in CI alike.
 */
function resolvePluginDepsFromDeploy(): Plugin {
    const anchor = path.join(deployDir, 'vitest.config.mts');
    return {
        name: 'resolve-plugin-deps-from-deploy',
        enforce: 'pre',
        async resolveId(source, importer) {
            const isBare = !source.startsWith('.') && !path.isAbsolute(source) && !source.startsWith('\0');
            if (!isBare || !importer || !path.resolve(importer).startsWith(pluginsDir)) {
                return null;
            }
            return this.resolve(source, anchor, { skipSelf: true });
        },
    };
}

export default defineConfig({
    plugins: [
        resolvePluginDepsFromDeploy(),
        // SWC: Vendure entities and resolvers need decorator metadata, which esbuild lacks.
        swc.vite({
            jsc: { transform: { useDefineForClassFields: false } },
        }) as any,
    ],
    server: {
        fs: { allow: [path.resolve(deployDir, '..')] },
    },
    test: {
        root: path.resolve(deployDir, '..'),
        include: ['plugins/**/e2e/**/*.e2e-spec.ts', 'deploy/e2e/**/*.e2e-spec.ts'],
        environment: 'node',
        testTimeout: 60_000,
        hookTimeout: 120_000,
        // A fresh process per spec (Vendure keeps plugin metadata in module-level state),
        // run one after the other since every spec binds the same test port.
        pool: 'forks',
        isolate: true,
        fileParallelism: false,
    },
});
