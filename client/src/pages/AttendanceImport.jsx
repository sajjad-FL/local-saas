import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { XIcon, DownloadIcon, CheckCircleIcon } from '../ui.jsx';

const fmtDay = (d) => d && new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Read an eSSL / ZKTeco export (Excel or CSV) into rows of text. SheetJS loads only here.
async function readRows(file) {
  const XLSX = await import('xlsx');
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  // dates come out year-first so they can't be misread as month/day
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', dateNF: 'yyyy-mm-dd hh:mm:ss' });
}

// Import a fingerprint/face machine's export: choose file → check who's who → import.
// Machine IDs are linked to members once; after that, imports need no input.
export default function AttendanceImport({ biz, onClose }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [readError, setReadError] = useState('');
  const [columns, setColumns] = useState(null); // null = let the server detect them
  const [links, setLinks] = useState({}); // machineId -> memberId ('' = skip)
  const [showCols, setShowCols] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['members', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/members`),
  });

  const preview = useQuery({
    queryKey: ['attendance-import', biz._id, fileName, columns],
    queryFn: () => api(`/businesses/${biz._id}/attendance/import`, { method: 'POST', body: { rows, columns, dryRun: true } }),
    enabled: !!rows,
    retry: false,
  });
  const p = preview.data;

  // unlinked IDs: the owner's pick, else the name-match suggestion
  const pick = (e) => (e.machineId in links ? links[e.machineId] : e.suggestedMemberId || '');
  const newLinks = p ? Object.fromEntries(p.people.filter((e) => !e.memberId && pick(e)).map((e) => [e.machineId, pick(e)])) : {};
  const willImport = p ? p.people.filter((e) => e.memberId || newLinks[e.machineId]) : [];
  const days = willImport.reduce((s, e) => s + e.days, 0);

  const run = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/attendance/import`, { method: 'POST', body: { rows, columns, links: newLinks } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', biz._id] });
      qc.invalidateQueries({ queryKey: ['member-attendance'] });
      qc.invalidateQueries({ queryKey: ['not-coming', biz._id] });
      qc.invalidateQueries({ queryKey: ['members', biz._id] });
    },
  });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReadError(''); setColumns(null); setLinks({}); setShowCols(false); run.reset();
    try {
      const r = await readRows(file);
      if (!r.length) throw new Error('the file is empty');
      setFileName(`${file.name}:${file.size}:${file.lastModified}`);
      setRows(r);
    } catch (err) {
      setReadError(`Couldn't read that file (${err.message}). Export it again as Excel (.xlsx) or CSV.`);
    }
  };

  const header = p?.header || preview.error?.header?.[0] || rows?.[0] || [];
  const colSelect = (key, label, optional) => (
    <label className="imp-col">
      <span>{label}</span>
      <select value={(columns || p?.columns || {})[key] ?? -1}
        onChange={(e) => setColumns({ ...(columns || p?.columns || { id: -1, name: -1, datetime: -1, date: -1, time: -1 }), [key]: Number(e.target.value) })}>
        <option value={-1}>{optional ? '—' : 'Pick a column'}</option>
        {header.map((h, i) => <option key={i} value={i}>{String(h || `Column ${i + 1}`)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DownloadIcon size={17} style={{ color: 'var(--primary)' }} /> Import from attendance machine
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>

        {run.data ? (
          <div className="imp-done" role="status">
            <CheckCircleIcon size={40} />
            <h4>{run.data.added + run.data.updated ? 'Imported' : 'Already up to date'}</h4>
            <p>
              {run.data.added + run.data.updated ? (
                <>
                  <b>{run.data.added + run.data.updated}</b> day{run.data.added + run.data.updated === 1 ? '' : 's'} marked present
                  for <b>{run.data.membersMatched}</b> member{run.data.membersMatched === 1 ? '' : 's'} ({fmtDay(run.data.from)} – {fmtDay(run.data.to)}).
                </>
              ) : `These days (${fmtDay(run.data.from)} – ${fmtDay(run.data.to)}) were already imported. Nothing changed.`}
            </p>
            {run.data.notLinked > 0 && <p className="muted small">{run.data.notLinked} machine ID{run.data.notLinked === 1 ? ' was' : 's were'} not linked to a member and skipped.</p>}
            <button type="button" className="btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <ol className="imp-help muted small">
              <li>In your machine's software (eTimeTrackLite, ZKTime, BioTime…), open the attendance or punch log report.</li>
              <li>Choose the dates and export to <b>Excel</b> or <b>CSV</b>.</li>
              <li>Choose that file below. Importing the same days again won't create duplicates.</li>
            </ol>
            <label className="imp-file">
              <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={onFile} />
              <span className="btn btn-secondary">Choose file</span>
              <span className="muted small">{fileName ? fileName.split(':')[0] : 'Excel or CSV export'}</span>
            </label>
            {readError && <p className="error" role="alert">{readError}</p>}
            {preview.isFetching && <p className="muted small">Reading the file…</p>}

            {rows && p && !preview.error && !showCols && (
              <p className="imp-cols-line muted small">
                Columns: {['id', 'name', 'datetime', 'date', 'time'].map((k) => (columns || p.columns)[k]).filter((i) => i >= 0).map((i) => String(header[i])).join(' · ')}
                {' '}<button type="button" className="btn-link small" onClick={() => setShowCols(true)}>Change</button>
              </p>
            )}
            {rows && (preview.error || (p && showCols)) && (
              <div className="imp-cols">
                {preview.error && <p className="error" role="alert" style={{ marginTop: 0 }}>{preview.error.message}. Pick the columns:</p>}
                {colSelect('id', 'Machine ID')}
                {colSelect('name', 'Name', true)}
                {colSelect('datetime', 'Date & time', true)}
                {colSelect('date', 'Date (if separate)', true)}
                {colSelect('time', 'Time (if separate)', true)}
              </div>
            )}

            {p && (
              <>
                <p className="imp-summary">
                  <b>{p.punches.toLocaleString('en-IN')}</b> punches from <b>{p.people.length}</b> people, {fmtDay(p.from)} – {fmtDay(p.to)}
                  {p.skipped > 0 && <span className="muted"> · {p.skipped} unreadable row{p.skipped === 1 ? '' : 's'} ignored</span>}
                </p>
                {p.people.some((e) => !e.memberId) && (
                  <div className="imp-people">
                    <h4>Who is who? <span className="muted small">(saved for next time)</span></h4>
                    {p.people.filter((e) => !e.memberId).map((e) => (
                      <div key={e.machineId} className="imp-person">
                        <div className="imp-person-id">
                          <b>ID {e.machineId}</b>
                          <span className="muted small">{e.name || 'No name'} · {e.days} day{e.days === 1 ? '' : 's'}</span>
                        </div>
                        <select aria-label={`Member for machine ID ${e.machineId}`} value={pick(e)}
                          onChange={(ev) => setLinks({ ...links, [e.machineId]: ev.target.value })}>
                          <option value="">Don't import</option>
                          {members.map((m) => <option key={m._id} value={m._id}>{m.name}{m.phone ? ` · ${m.phone}` : ''}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                {p.people.some((e) => e.memberId) && (
                  <p className="muted small">{p.people.filter((e) => e.memberId).length} machine ID{p.people.filter((e) => e.memberId).length === 1 ? ' is' : 's are'} already linked to members.</p>
                )}
                {run.error && <p className="error" role="alert">{run.error.message}</p>}
                <div className="expense-form-actions">
                  <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                  <button type="button" className="btn" disabled={!willImport.length || run.isPending} onClick={() => run.mutate()}>
                    {run.isPending ? 'Importing…' : `Import ${days} day${days === 1 ? '' : 's'} for ${willImport.length} member${willImport.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
