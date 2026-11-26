const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Every Text and TextInput in the app's own code uses Inter, like the web app (src/ui/).
// Phones: 'react-native' → src/ui/rn.js. Web: Babel has already turned
// `import { Text } from 'react-native'` into react-native-web's own Text file, so those two
// files are swapped instead. Libraries, and src/ui itself, get the real components.
const SRC = path.join(__dirname, 'src') + path.sep;
const UI = path.join(__dirname, 'src', 'ui') + path.sep;
const SWAP = {
  'react-native': path.join(UI, 'rn.js'),
  'react-native-web/dist/exports/Text': path.join(UI, 'Text.js'),
  'react-native-web/dist/exports/TextInput': path.join(UI, 'TextInput.js'),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = context.originModulePath || '';
  const to = SWAP[moduleName];
  if (to && from.startsWith(SRC) && !from.startsWith(UI)) {
    return context.resolveRequest(context, to, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
