import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Link2, Upload, Download, CheckCircle, AlertCircle, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { useStore } from '../store';

const APPS_SCRIPT_CODE = `// Paste this in Google Apps Script (script.google.com)
// Bound to your Google Sheet or standalone

const SHEET_NAME = 'ASplit';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === 'push') {
      writeSheet(ss, 'Trips', data.trips, ['id','name','description','currency','startDate','endDate','status']);
      writeSheet(ss, 'Expenses', data.expenses, ['id','tripId','title','amount','category','date','time','notes']);
      writeSheet(ss, 'Members', data.members, ['id','name','email','upi','role']);
      return ok({ message: 'Synced successfully' });
    }
  } catch(err) {
    return ok({ error: err.message });
  }
}

function doGet(e) {
  if (e.parameter.action === 'fetch') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ok({
      trips:    readSheet(ss, 'Trips'),
      expenses: readSheet(ss, 'Expenses'),
      members:  readSheet(ss, 'Members'),
    });
  }
  return ok({ status: 'ASplit connected' });
}

function writeSheet(ss, name, rows, cols) {
  let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  if (!rows || !rows.length) return;
  sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
  const data = rows.map(r => cols.map(c => r[c] ?? ''));
  sheet.getRange(2, 1, data.length, cols.length).setValues(data);
}

function readSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const [headers, ...rows] = sheet.getDataRange().getValues();
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export default function SheetSyncScreen() {
  const { state, dispatch, nav, syncNow, pullFromSheet } = useStore();
  const [url, setUrl] = useState(state.sheetScriptUrl);
  const [copied, setCopied] = useState(false);
  const { syncStatus, syncMessage } = state;

  const saveUrl = () => {
    dispatch({ type: 'SET_SHEET_URL', url: url.trim() });
    dispatch({ type: 'SYNC_STATUS', status: 'idle' });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isSyncing = syncStatus === 'syncing';

  return (
    <div className="screen">
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => nav('profile')}><ArrowLeft size={20} /></button>
        <div>
          <p className="t-heading">Google Sheets Sync</p>
          <p className="t-caption c-3">Keep your data in a spreadsheet</p>
        </div>
      </div>

      <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Status banner */}
        <AnimatePresence>
          {syncStatus !== 'idle' && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                background: syncStatus === 'success' ? 'var(--success-light)' : syncStatus === 'error' ? 'var(--danger-light)' : 'var(--accent-light)',
              }}>
              {syncStatus === 'syncing' && <RefreshCw size={16} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} />}
              {syncStatus === 'success' && <CheckCircle size={16} color="var(--success)" />}
              {syncStatus === 'error'   && <AlertCircle size={16} color="var(--danger)" />}
              <p style={{ fontSize: 13, fontWeight: 500, color: syncStatus === 'success' ? 'var(--success)' : syncStatus === 'error' ? 'var(--danger)' : 'var(--accent)' }}>
                {syncStatus === 'syncing' ? 'Syncing...' : syncMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1 */}
        <div className="card card-p">
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>1</span>
            </div>
            <p className="t-heading">Create a Google Sheet</p>
          </div>
          <p className="t-body c-2" style={{ marginBottom: 12, lineHeight: 1.6 }}>
            Open <strong>script.google.com</strong>, create a new project, paste the Apps Script code below, then deploy as a Web App with access set to <em>Anyone</em>.
          </p>
          <a href="https://script.google.com" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            <ExternalLink size={14} /> Open Apps Script
          </a>
        </div>

        {/* Code block */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
            <span className="t-caption c-2" style={{ fontFamily: 'monospace' }}>Code.gs</span>
            <button className="btn btn-ghost btn-sm" onClick={copyCode} style={{ gap: 6 }}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <pre style={{ padding: '12px 14px', fontSize: 11, lineHeight: 1.6, color: 'var(--text-2)', overflowX: 'auto', margin: 0, fontFamily: 'monospace', maxHeight: 160, overflowY: 'auto' }}>
            {APPS_SCRIPT_CODE.slice(0, 400)}...
          </pre>
        </div>

        {/* Step 2 */}
        <div className="card card-p">
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>2</span>
            </div>
            <p className="t-heading">Paste your Web App URL</p>
          </div>
          <div className="input-group">
            <div style={{ position: 'relative' }}>
              <Link2 size={15} color="var(--text-3)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
              <input className="input" placeholder="https://script.google.com/macros/s/..." value={url} onChange={e => setUrl(e.target.value)} style={{ paddingLeft: 40, fontSize: 13 }} />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={saveUrl}>
            Save URL
          </button>
        </div>

        {/* Step 3 — Sync actions */}
        <div className="card card-p">
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>3</span>
            </div>
            <p className="t-heading">Sync your data</p>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-primary flex-1" disabled={!state.sheetScriptUrl || isSyncing} onClick={syncNow}>
              <Upload size={16} /> Push to Sheet
            </button>
            <button className="btn btn-outline flex-1" disabled={!state.sheetScriptUrl || isSyncing} onClick={pullFromSheet}>
              <Download size={16} /> Pull from Sheet
            </button>
          </div>
          {!state.sheetScriptUrl && (
            <p className="t-caption c-3" style={{ marginTop: 8 }}>Save a Web App URL above to enable sync.</p>
          )}
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
