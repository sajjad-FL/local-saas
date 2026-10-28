import React, { useMemo } from 'react';
import { View } from 'react-native';
import QRCode from 'qrcode';

// A QR code drawn with plain views (no native SVG needed). Runs of dark squares in a row
// are drawn as one bar, which keeps the view count low.
export default function QrCode({ value, size = 180, color = '#000000', background = '#FFFFFF', margin = 1 }) {
  const qr = useMemo(() => {
    if (!value) return null;
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const rows = [];
    for (let r = 0; r < modules.size; r++) {
      const runs = [];
      let start = -1;
      for (let c = 0; c <= modules.size; c++) {
        const dark = c < modules.size && modules.get(r, c);
        if (dark && start < 0) start = c;
        if (!dark && start >= 0) { runs.push([start, c - start]); start = -1; }
      }
      rows.push(runs);
    }
    return { count: modules.size, rows };
  }, [value]);

  if (!qr) return <View style={{ width: size, height: size, backgroundColor: background }} />;
  const cell = size / (qr.count + margin * 2);

  return (
    <View style={{ width: size, height: size, backgroundColor: background, padding: cell * margin }}>
      {qr.rows.map((runs, r) => (
        <View key={r} style={{ height: cell, flexDirection: 'row' }}>
          {runs.map(([c, len]) => (
            <View key={c} style={{ position: 'absolute', left: c * cell, width: len * cell + 0.5, height: cell + 0.5, backgroundColor: color }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// The same code as an SVG string, for the printed poster
export const qrSvg = (value) => QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
