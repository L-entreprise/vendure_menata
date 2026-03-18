import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import path from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

const parsedApiPort = Number(process.env.VENDURE_API_PORT);
const dashboardApiHost = process.env.VENDURE_API_HOST ?? 'auto';
const dashboardApiPort = Number.isFinite(parsedApiPort) && parsedApiPort > 0 ? parsedApiPort : 3000;

export default defineConfig({
    base: '/dashboard/',
    plugins: [
        vendureDashboardPlugin({
            vendureConfigPath: pathToFileURL('./dev-config.ts'),
            pathAdapter: {
                getCompiledConfigPath: ({ inputRootDir, outputPath, configFileName }) => {
                    // The plugin at ../../plugins/ causes TypeScript to nest output
                    // under packages/dev-server/ within the temp dir
                    const repoRoot = path.resolve(__dirname, '../..');
                    const relativeDir = path.relative(repoRoot, inputRootDir);
                    return path.join(outputPath, relativeDir, configFileName);
                },
            },
            theme: {
                light: {
                    background: '#f7f9fe',
                    foreground: '#000000',
                    card: '#ffffff',
                    'card-foreground': '#000000',
                    popover: '#ffffff',
                    'popover-foreground': '#000000',
                    primary: '#628eda',
                    'primary-foreground': '#ffffff',
                    secondary: '#ece4f8',
                    'secondary-foreground': '#65379a',
                    muted: '#edf2fc',
                    'muted-foreground': '#475569',
                    accent: '#65379a',
                    'accent-foreground': '#ffffff',
                    border: '#d9e2f2',
                    input: '#d9e2f2',
                    ring: '#65379a',
                    'chart-1': '#628eda',
                    'chart-2': '#65379a',
                    'chart-3': '#7ba4e6',
                    'chart-4': '#8a6ab8',
                    'chart-5': '#2f4f86',
                    sidebar: '#000000',
                    'sidebar-foreground': '#f8f8fa',
                    'sidebar-primary': '#628eda',
                    'sidebar-primary-foreground': '#ffffff',
                    'sidebar-accent': '#65379a',
                    'sidebar-accent-foreground': '#ffffff',
                    'sidebar-border': '#1a1a1a',
                    'sidebar-ring': '#628eda',
                    brand: '#628eda',
                    'brand-lighter': '#edf2fc',
                    'brand-darker': '#4f78bf',
                    'font-sans': '"Space Grotesk", Inter, sans-serif',
                    'font-mono': '"IBM Plex Mono", monospace',
                },
                dark: {
                    background: '#090c14',
                    foreground: '#f7f9fe',
                    card: '#101624',
                    'card-foreground': '#f7f9fe',
                    popover: '#101624',
                    'popover-foreground': '#f7f9fe',
                    primary: '#628eda',
                    'primary-foreground': '#000000',
                    secondary: '#2a1f3d',
                    'secondary-foreground': '#ece4f8',
                    muted: '#1a2236',
                    'muted-foreground': '#b6c4de',
                    accent: '#65379a',
                    'accent-foreground': '#ffffff',
                    border: '#22304a',
                    input: '#22304a',
                    ring: '#628eda',
                    'chart-1': '#628eda',
                    'chart-2': '#65379a',
                    'chart-3': '#90b0e8',
                    'chart-4': '#9a7ac9',
                    'chart-5': '#405f96',
                    sidebar: '#000000',
                    'sidebar-foreground': '#f7f9fe',
                    'sidebar-primary': '#628eda',
                    'sidebar-primary-foreground': '#000000',
                    'sidebar-accent': '#65379a',
                    'sidebar-accent-foreground': '#ffffff',
                    'sidebar-border': '#1a1a1a',
                    'sidebar-ring': '#628eda',
                    brand: '#628eda',
                    'brand-lighter': '#edf2fc',
                    'brand-darker': '#4f78bf',
                    'font-sans': '"Space Grotesk", Inter, sans-serif',
                    'font-mono': '"IBM Plex Mono", monospace',
                },
            },
            api: {
                host: dashboardApiHost,
                port: dashboardApiPort,
            },
            gqlOutputPath: path.resolve(__dirname, './graphql/'),
        }),
    ],
});
