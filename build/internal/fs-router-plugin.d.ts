import { Plugin } from 'vite';
interface PluginOptions {
    pagesDir: string;
    bundlePreact?: boolean;
    prerender?: boolean;
    htmlClassName?: string;
}
export interface SiteManifest {
    routes: Record<string, string>;
}
declare const vitePluginRouter: ({ bundlePreact, prerender, ...options }: PluginOptions) => Plugin;
export default vitePluginRouter;
