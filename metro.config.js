const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');

/**
 * Local file: packages ship their own node_modules (e.g. insights-react-native
 * has react-native@0.76 for vitest). Hierarchical lookup would serve that JS to
 * a 0.87 native binary → TurboModuleRegistry PlatformConstants "runtime not ready".
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    path.resolve(monorepoRoot, 'insights-react-native'),
    path.resolve(monorepoRoot, 'insights-embed'),
  ],
  resolver: {
    unstable_enableSymlinks: true,
    // Required for RN 0.87 packages that only expose `exports` (e.g. asset-utils).
    // Nested react-native@0.76 is still blocked via disableHierarchicalLookup.
    unstable_enablePackageExports: true,
    // Only resolve from the demo app's node_modules, never from linked pkgs.
    disableHierarchicalLookup: true,
    nodeModulesPaths: [appNodeModules],
    extraNodeModules: {
      react: path.resolve(appNodeModules, 'react'),
      'react-native': path.resolve(appNodeModules, 'react-native'),
      '@react-native-async-storage/async-storage': path.resolve(
        appNodeModules,
        '@react-native-async-storage/async-storage',
      ),
      'react-native-device-info': path.resolve(
        appNodeModules,
        'react-native-device-info',
      ),
      'react-native-uuid': path.resolve(appNodeModules, 'react-native-uuid'),
      'react-native-video': path.resolve(appNodeModules, 'react-native-video'),
      'react-native-url-polyfill': path.resolve(
        appNodeModules,
        'react-native-url-polyfill',
      ),
      '@gumlet/insights-js-core': path.resolve(
        monorepoRoot,
        'insights-embed',
      ),
      '@gumlet/insights-react-native': path.resolve(
        monorepoRoot,
        'insights-react-native',
      ),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
