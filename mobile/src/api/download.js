import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './api';

// Fetch a file from the API (signed in), save it and open the share sheet so it can go to
// WhatsApp, Drive, Files... In the browser it downloads instead.
export async function downloadFile(path, filename) {
  const res = await api(path);
  const content = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
  const name = filename.replace(/[\s/\\]+/g, '_');

  if (Platform.OS === 'web') {
    const type = name.endsWith('.json') ? 'application/json' : 'text/csv';
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  }

  const file = new File(Paths.document, name);
  file.create({ overwrite: true });
  file.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
  return file.uri;
}
