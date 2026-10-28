import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/api';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const fmtDay = (d) => d && new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const COLS = [
  ['id', 'Machine ID', false],
  ['name', 'Name', true],
  ['datetime', 'Date & time', true],
  ['date', 'Date (if separate)', true],
  ['time', 'Time (if separate)', true],
];

// Read an eSSL / ZKTeco export (Excel or CSV) into rows of text, same as the web
async function readRows(asset) {
  const data = Platform.OS === 'web' && asset.file
    ? new Uint8Array(await asset.file.arrayBuffer())
    : await new File(asset.uri).bytes();
  const book = XLSX.read(data, { type: 'array', cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  // dates come out year-first so they can't be misread as month/day
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', dateNF: 'yyyy-mm-dd hh:mm:ss' });
}

// A tap-to-open list, standing in for the web's <select>
function Select({ theme, value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen((o) => !o)}
        style={[styles.select, { borderColor: open ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.card }]}>
        <Text style={[styles.selectText, { color: current ? theme.colors.text : theme.colors.textMuted }]} numberOfLines={1}>
          {current ? current.label : placeholder}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} color={theme.colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <ScrollView nestedScrollEnabled style={[styles.options, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          {options.map((o) => (
            <TouchableOpacity
              key={String(o.value)}
              onPress={() => { onChange(o.value); setOpen(false); }}
              style={[styles.option, o.value === value && { backgroundColor: theme.colors.primarySoft }]}>
              <Text style={{ color: theme.colors.text, fontSize: 13 }} numberOfLines={1}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Import a fingerprint/face machine's export: choose file → check who's who → import.
// Machine IDs are linked to members once; after that, imports need no input.
export default function AttendanceImportModal({ visible, biz, onClose, onImported }) {
  const { theme } = useTheme();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [readError, setReadError] = useState('');
  const [columns, setColumns] = useState(null); // null = let the server detect them
  const [links, setLinks] = useState({}); // machineId -> memberId ('' = skip)
  const [showCols, setShowCols] = useState(false);
  const [members, setMembers] = useState([]);
  const [preview, setPreview] = useState(null); // { data } | { error, header }
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');

  const reset = () => {
    setRows(null); setFileName(''); setReadError(''); setColumns(null); setLinks({});
    setShowCols(false); setPreview(null); setResult(null); setRunError('');
  };

  useEffect(() => {
    if (!visible || !biz?._id) return;
    reset();
    api(`/businesses/${biz._id}/members`).then((m) => setMembers(Array.isArray(m) ? m : [])).catch(() => {});
  }, [visible, biz?._id]);

  // dry run: the server detects columns and matches machine IDs to members
  const runPreview = useCallback(async (r, cols) => {
    setReading(true);
    try {
      const data = await api(`/businesses/${biz._id}/attendance/import`, { method: 'POST', body: { rows: r, columns: cols, dryRun: true } });
      setPreview({ data });
    } catch (err) {
      setPreview({ error: err.message, header: err.body?.header?.[0] });
    } finally {
      setReading(false);
    }
  }, [biz?._id]);

  const chooseFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setReadError(''); setColumns(null); setLinks({}); setShowCols(false); setResult(null); setPreview(null);
    try {
      const r = await readRows(asset);
      if (!r.length) throw new Error('the file is empty');
      setFileName(asset.name);
      setRows(r);
      runPreview(r, null);
    } catch (err) {
      setReadError(`Couldn't read that file (${err.message}). Export it again as Excel (.xlsx) or CSV.`);
    }
  };

  const p = preview?.data;
  const header = p?.header || preview?.header || rows?.[0] || [];
  const pick = (e) => (e.machineId in links ? links[e.machineId] : e.suggestedMemberId || '');
  const newLinks = p ? Object.fromEntries(p.people.filter((e) => !e.memberId && pick(e)).map((e) => [e.machineId, pick(e)])) : {};
  const willImport = p ? p.people.filter((e) => e.memberId || newLinks[e.machineId]) : [];
  const days = willImport.reduce((s, e) => s + e.days, 0);
  const linkedCount = p ? p.people.filter((e) => e.memberId).length : 0;

  const setColumn = (key, idx) => {
    const next = { ...(columns || p?.columns || { id: -1, name: -1, datetime: -1, date: -1, time: -1 }), [key]: idx };
    setColumns(next);
    runPreview(rows, next);
  };

  const runImport = async () => {
    setRunning(true);
    setRunError('');
    try {
      const data = await api(`/businesses/${biz._id}/attendance/import`, { method: 'POST', body: { rows, columns, links: newLinks } });
      setResult(data);
      onImported?.();
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const muted = { color: theme.colors.textSecondary };
  const done = result && result.added + result.updated;

  return (
    <Modal visible={visible} onClose={onClose} title="Import from attendance machine" maxHeight="92%">
      {result ? (
        <View style={styles.done}>
          <Icon name="checkmark-circle" size={44} color={theme.colors.primary} />
          <Text style={[styles.doneTitle, { color: theme.colors.text }]}>{done ? 'Imported' : 'Already up to date'}</Text>
          <Text style={[styles.body, muted, { textAlign: 'center' }]}>
            {done
              ? `${done} day${done === 1 ? '' : 's'} marked present for ${result.membersMatched} member${result.membersMatched === 1 ? '' : 's'} (${fmtDay(result.from)} – ${fmtDay(result.to)}).`
              : `These days (${fmtDay(result.from)} – ${fmtDay(result.to)}) were already imported. Nothing changed.`}
          </Text>
          {result.notLinked > 0 && (
            <Text style={[styles.small, muted]}>
              {result.notLinked} machine ID{result.notLinked === 1 ? ' was' : 's were'} not linked to a member and skipped.
            </Text>
          )}
          <Button title="Done" variant="primary" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      ) : (
        <View>
          {[
            "In your machine's software (eTimeTrackLite, ZKTime, BioTime…), open the attendance or punch log report.",
            'Choose the dates and export to Excel or CSV.',
            "Choose that file below. Importing the same days again won't create duplicates.",
          ].map((t, i) => (
            <Text key={i} style={[styles.small, muted, { marginBottom: 4 }]}>{i + 1}. {t}</Text>
          ))}

          <View style={styles.fileRow}>
            <Button title="Choose file" variant="outline" size="sm" onPress={chooseFile} />
            <Text style={[styles.small, muted, { flex: 1 }]} numberOfLines={1}>{fileName || 'Excel or CSV export'}</Text>
          </View>
          {readError ? <Text style={[styles.small, { color: theme.colors.danger }]}>{readError}</Text> : null}
          {reading ? <Text style={[styles.small, muted]}>Reading the file…</Text> : null}

          {rows && p && !showCols && (
            <Text style={[styles.small, muted, { marginTop: 8 }]}>
              Columns: {COLS.map(([k]) => (columns || p.columns)[k]).filter((i) => i >= 0).map((i) => String(header[i])).join(' · ')}{' '}
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }} onPress={() => setShowCols(true)}>Change</Text>
            </Text>
          )}
          {rows && (preview?.error || (p && showCols)) && (
            <View style={{ gap: 8, marginTop: 10 }}>
              {preview?.error ? <Text style={[styles.small, { color: theme.colors.danger }]}>{preview.error}. Pick the columns:</Text> : null}
              {COLS.map(([key, label, optional]) => (
                <View key={key}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
                  <Select
                    theme={theme}
                    value={(columns || p?.columns || {})[key] ?? -1}
                    placeholder={optional ? '—' : 'Pick a column'}
                    options={[{ value: -1, label: optional ? '—' : 'Pick a column' }, ...header.map((h, i) => ({ value: i, label: String(h || `Column ${i + 1}`) }))]}
                    onChange={(v) => setColumn(key, v)}
                  />
                </View>
              ))}
            </View>
          )}

          {p && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.body, { color: theme.colors.text }]}>
                <Text style={{ fontWeight: '700' }}>{p.punches.toLocaleString('en-IN')}</Text> punches from{' '}
                <Text style={{ fontWeight: '700' }}>{p.people.length}</Text> people, {fmtDay(p.from)} – {fmtDay(p.to)}
                {p.skipped > 0 ? <Text style={muted}> · {p.skipped} unreadable row{p.skipped === 1 ? '' : 's'} ignored</Text> : null}
              </Text>

              {p.people.some((e) => !e.memberId) && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Who is who? <Text style={[styles.small, muted]}>(saved for next time)</Text>
                  </Text>
                  {p.people.filter((e) => !e.memberId).map((e) => (
                    <View key={e.machineId} style={[styles.person, { borderColor: theme.colors.border }]}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>ID {e.machineId}</Text>
                      <Text style={[styles.small, muted, { marginBottom: 6 }]}>{e.name || 'No name'} · {e.days} day{e.days === 1 ? '' : 's'}</Text>
                      <Select
                        theme={theme}
                        value={pick(e)}
                        placeholder="Don't import"
                        options={[{ value: '', label: "Don't import" }, ...members.map((m) => ({ value: m._id, label: `${m.name}${m.phone ? ` · ${m.phone}` : ''}` }))]}
                        onChange={(v) => setLinks((l) => ({ ...l, [e.machineId]: v }))}
                      />
                    </View>
                  ))}
                </View>
              )}
              {linkedCount > 0 && (
                <Text style={[styles.small, muted, { marginTop: 8 }]}>
                  {linkedCount} machine ID{linkedCount === 1 ? ' is' : 's are'} already linked to members.
                </Text>
              )}
              {runError ? <Text style={[styles.small, { color: theme.colors.danger, marginTop: 8 }]}>{runError}</Text> : null}
              <View style={styles.actions}>
                <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
                <Button
                  title={running ? 'Importing…' : `Import ${days} day${days === 1 ? '' : 's'} for ${willImport.length} member${willImport.length === 1 ? '' : 's'}`}
                  variant="primary"
                  disabled={!willImport.length || running}
                  onPress={runImport}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 12.5, lineHeight: 18 },
  body: { fontSize: 13.5, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, height: 40, paddingHorizontal: 10, gap: 8 },
  selectText: { fontSize: 13, flex: 1 },
  options: { borderWidth: 1, borderRadius: 8, marginTop: 4, maxHeight: 200 },
  option: { paddingHorizontal: 10, paddingVertical: 9 },
  person: { borderWidth: 1, borderRadius: 10, padding: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  done: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  doneTitle: { fontSize: 17, fontWeight: '700' },
});
