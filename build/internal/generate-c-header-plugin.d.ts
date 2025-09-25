import { Plugin } from 'vite';
interface PluginOptions {
    bundlePreact?: boolean;
}
declare const viteGenerateCHeader: ({ bundlePreact }?: PluginOptions) => Plugin;
export default viteGenerateCHeader;
