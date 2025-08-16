// ======= KhataFlow =======
const STORAGE_KEY = 'khataflow_invoices_v1';

const els = {
  themeToggle: document.getElementById('themeToggle'),
  exportCSV: document.getElementById('exportCSV'),
  backupJSON: document.getElementById('backupJSON'),
  importFile: document.getElementById('importFile'),
  resetApp: document.getElementById('resetApp'),

  form: document.getElementById('invoiceForm'),
  invoiceId: document.getElementById('invoiceId'),
  client: document.getElementById('client'),
  category: document.getElementById('category'),
  amount: document.getElementById('amount'),
  issueDate: document.getElementById('issueDate'),
  dueDate: document.getElementById('dueDate'),
  status: document.getElementById('status'),
  notes: document.getElementById('notes'),
  saveBtn: document.getElementById('saveBtn'),
  clearBtn: document.getElementById('clearBtn'),

  statPaid: document.getElementById('statPaid'),
  statPending: document.getElementById('statPending'),
  statOverdue: document.getElementById('statOverdue'),

  search: document.getElementById('search'),
  filterStatus: document.getElementById('filterStatus'),
  filterCategory: document.getElementById('filterCategory'),
  fromDate: document.getElementById('fromDate'),
  toDate: document.getElementById('toDate'),
  clearFilters: document.getElementById('clearFilters'),

  table: document.getElementById('invoiceTable'),
  tbody: document.querySelector('#invoiceTable tbody'),
  empty: document.getElementById('emptyState'),

  toast: document.getElementById('toast'),
  chart: document.getElementById('revenueChart'),
};

let invoices = load() || seed();
let sort = { key: 'issueDate', dir: 'desc' };
let theme = localStorage.getItem('khataflow_theme') || 'light';
document.documentElement.setAttribute('data-theme', theme);

// ----- Utils -----
const fmtINR = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0,10);
const isOverdue = inv => inv.status !== 'Paid' && inv.dueDate && new Date(inv.dueDate) < stripTime(new Date());
function stripTime(d){ const x = new Date(d); x.setHours(0,0,0,0); return x; }
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function showToast(msg){ els.toast.textContent = msg; els.toast.classList.add('show'); setTimeout(()=>els.toast.classList.remove('show'), 1800); }

function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices)); }

// Seed sample data if empty
function seed() {
  const d = todayISO();
  const addDays = (base, days) => new Date(new Date(base).getTime() + days*86400000).toISOString().slice(0,10);
  const sample = [
    {id:uid(), client:'Acme Pvt Ltd', category:'Web Design', amount:25000, issueDate:addDays(d,-25), dueDate:addDays(d,-10), status:'Paid', notes:'Landing page'},
    {id:uid(), client:'Bright Consulting', category:'Consulting', amount:12000, issueDate:addDays(d,-14), dueDate:addDays(d,-2), status:'Pending', notes:'Audit'},
    {id:uid(), client:'Nimbus Labs', category:'Development', amount:40000, issueDate:addDays(d,-5), dueDate:addDays(d,7), status:'Pending', notes:'Dashboard'},
  ];
  saveArray(sample);
  return sample;
}
function saveArray(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

// ----- Rendering -----
function render() {
  // filters
  const s = els.search.value.trim().toLowerCase();
  const fs = els.filterStatus.value;
  const fc = els.filterCategory.value.trim().toLowerCase();
  const fd = els.fromDate.value ? new Date(els.fromDate.value) : null;
  const td = els.toDate.value ? new Date(els.toDate.value) : null;

  let list = [...invoices].filter(inv => {
    const hay = `${inv.client} ${inv.notes} ${inv.category}`.toLowerCase();
    if (s && !hay.includes(s)) return false;
    const derivedStatus = isOverdue(inv) ? 'Overdue' : inv.status;
    if (fs && derivedStatus !== fs) return false;
    if (fc && !(inv.category || '').toLowerCase().includes(fc)) return false;
    if (fd && new Date(inv.issueDate) < fd) return false;
    if (td && new Date(inv.issueDate) > td) return false;
    return true;
  });

  // sort
  list.sort((a,b)=>{
    const k = sort.key;
    let va = a[k], vb = b[k];
    if (k === 'amount') { va = Number(va); vb = Number(vb); }
    if (k === 'issueDate' || k === 'dueDate') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    const res = va > vb ? 1 : va < vb ? -1 : 0;
    return sort.dir === 'asc' ? res : -res;
  });

  els.tbody.innerHTML = '';
  list.forEach(inv => {
    const tr = document.createElement('tr');
    const derived = isOverdue(inv) ? 'Overdue' : inv.status;
    tr.innerHTML = `
      <td>${escape(inv.client)}</td>
      <td>${escape(inv.category || '')}</td>
      <td class="right">${fmtINR(inv.amount)}</td>
      <td>${inv.issueDate}</td>
      <td>${inv.dueDate}</td>
      <td>${badge(derived)}</td>
      <td class="right">
        <div class="actions">
          <button class="action" data-action="edit" data-id="${inv.id}">Edit</button>
          <button class="action" data-action="print" data-id="${inv.id}">Print</button>
          <button class="action danger" data-action="delete" data-id="${inv.id}">Delete</button>
        </div>
      </td>
    `;
    els.tbody.appendChild(tr);
  });

  els.empty.classList.toggle('hidden', list.length !== 0);

  // totals
  const totals = invoices.reduce((acc, inv)=>{
    const amt = Number(inv.amount) || 0;
    if (inv.status === 'Paid') acc.paid += amt;
    else if (isOverdue(inv)) acc.overdue += amt;
    else acc.pending += amt;
    return acc;
  }, {paid:0, pending:0, overdue:0});
  els.statPaid.textContent = fmtINR(totals.paid);
  els.statPending.textContent = fmtINR(totals.pending);
  els.statOverdue.textContent = fmtINR(totals.overdue);

  drawChart();
}

function badge(status) {
  const cls = status === 'Paid' ? 'paid' : status === 'Pending' ? 'pending' : 'overdue';
  return `<span class="badge ${cls}">${status}</span>`;
}

function escape(s=''){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ----- Events -----
els.form.addEventListener('submit', e => {
  e.preventDefault();
  const inv = collectForm();
  if (!inv) return;
  if (els.invoiceId.value) {
    const idx = invoices.findIndex(x=>x.id === els.invoiceId.value);
    if (idx > -1) invoices[idx] = {...invoices[idx], ...inv};
    showToast('Invoice updated.');
  } else {
    invoices.push({ id: uid(), ...inv });
    showToast('Invoice added.');
  }
  save();
  clearForm();
  render();
});

els.clearBtn.addEventListener('click', clearForm);

function collectForm(){
  const client = els.client.value.trim();
  const category = els.category.value.trim();
  const amount = parseFloat(els.amount.value);
  const issueDate = els.issueDate.value;
  const dueDate = els.dueDate.value;
  const status = els.status.value;
  const notes = els.notes.value.trim();

  if (!client || !isFinite(amount) || !issueDate || !dueDate || !status) {
    showToast('Fill all required fields.');
    return null;
  }
  if (new Date(dueDate) < new Date(issueDate)) {
    showToast('Due date cannot be before issue date.');
    return null;
  }
  return { client, category, amount, issueDate, dueDate, status, notes };
}

function clearForm(){
  els.form.reset();
  els.invoiceId.value = '';
  els.issueDate.value = todayISO();
  els.dueDate.value = todayISO();
  els.saveBtn.textContent = 'Save';
}
clearForm();

// Table actions
els.tbody.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const inv = invoices.find(x=>x.id === id);
  if (!inv) return;

  if (action === 'delete') {
    if (confirm('Delete this invoice permanently?')) {
      invoices = invoices.filter(x=>x.id !== id);
      save(); render(); showToast('Invoice deleted.');
    }
  }
  if (action === 'edit') {
    els.invoiceId.value = inv.id;
    els.client.value = inv.client;
    els.category.value = inv.category || '';
    els.amount.value = inv.amount;
    els.issueDate.value = inv.issueDate;
    els.dueDate.value = inv.dueDate;
    els.status.value = inv.status;
    els.notes.value = inv.notes || '';
    els.saveBtn.textContent = 'Update';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (action === 'print') {
    printInvoice(inv);
  }
});

// Sorting
document.querySelectorAll('#invoiceTable thead th[data-sort]').forEach(th=>{
  th.addEventListener('click', ()=>{
    const key = th.dataset.sort;
    if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    else { sort.key = key; sort.dir = 'asc'; }
    render();
  });
});

// Filters
['input','change'].forEach(ev=>{
  els.search.addEventListener(ev, render);
  els.filterStatus.addEventListener(ev, render);
  els.filterCategory.addEventListener(ev, render);
  els.fromDate.addEventListener(ev, render);
  els.toDate.addEventListener(ev, render);
});
els.clearFilters.addEventListener('click', ()=>{
  els.search.value = '';
  els.filterStatus.value = '';
  els.filterCategory.value = '';
  els.fromDate.value = '';
  els.toDate.value = '';
  render();
});

// Theme
els.themeToggle.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('khataflow_theme', next);
});

// Export CSV
els.exportCSV.addEventListener('click', ()=>{
  const rows = [
    ['id','client','category','amount','issueDate','dueDate','status','notes'],
    ...invoices.map(i=>[i.id,i.client,i.category || '',i.amount,i.issueDate,i.dueDate,i.status,i.notes || ''])
  ];
  const csv = rows.map(r=>r.map(v=>String(v).includes(',')||String(v).includes('"')?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n');
  downloadFile('khataflow_invoices.csv', 'text/csv', csv);
});

// Backup JSON
els.backupJSON.addEventListener('click', ()=>{
  downloadFile('khataflow_backup.json', 'application/json', JSON.stringify(invoices, null, 2));
});

// Import CSV/JSON
els.importFile.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.json')) {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid JSON');
      invoices = normalizeImported(data);
    } else {
      invoices = parseCSV(text);
    }
    save(); render(); showToast('Import successful.');
  } catch(err) {
    console.error(err);
    showToast('Import failed.');
  } finally {
    e.target.value = '';
  }
});

// Reset
els.resetApp.addEventListener('click', ()=>{
  if (!confirm('This will delete all invoices. Continue?')) return;
  invoices = [];
  save(); render(); showToast('Reset complete.');
});

// ----- Chart (simple canvas bar chart) -----
function drawChart(){
  const ctx = els.chart.getContext('2d');
  const W = els.chart.width = els.chart.clientWidth * devicePixelRatio;
  const H = els.chart.height = 200 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0,0,W,H);
  const months = getRecentMonths(6); // [{label, y,m}]
  const sums = months.map(m=>{
    const total = invoices.filter(i=>{
      const d = new Date(i.issueDate);
      return d.getFullYear() === m.y && (d.getMonth()+1) === m.m && i.status === 'Paid';
    }).reduce((a,b)=>a+Number(b.amount||0),0);
    return total;
  });

  const pad = 28, chartH = 140, chartW = els.chart.clientWidth - pad*2;
  const max = Math.max(1, ...sums);
  // axes
  ctx.strokeStyle = 'rgba(150,150,160,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 10); ctx.lineTo(pad, 10+chartH); ctx.lineTo(pad+chartW, 10+chartH);
  ctx.stroke();

  const barW = chartW / (sums.length*1.6);
  const gap = barW*0.6;
  const x0 = pad + gap/2;

  sums.forEach((v,i)=>{
    const h = (v/max) * (chartH-6);
    const x = x0 + i*(barW+gap);
    const y = 10 + chartH - h;

    // gradient
    const g = ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0, getCSS('--accent'));
    g.addColorStop(1, getCSS('--accent-2'));
    ctx.fillStyle = g;
    roundRect(ctx, x, y, barW, h, 8, true);

    // label
    ctx.fillStyle = getText();
    ctx.font = '12px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(months[i].label, x + barW/2, 10 + chartH + 14);
  });
}

function getCSS(varName){ return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }
function getText(){ return getCSS('--text') || '#111'; }
function roundRect(ctx, x, y, w, h, r, fill){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  if (fill) ctx.fill();
}
function getRecentMonths(n){
  const out = [];
  const now = new Date();
  now.setDate(1);
  for (let i=n-1;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    out.push({ y: d.getFullYear(), m: d.getMonth()+1, label: d.toLocaleString('en-US',{month:'short'}) });
  }
  return out;
}

// ----- Print Invoice -----
function printInvoice(inv){
  const tpl = document.getElementById('printTemplate').content.cloneNode(true);
  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(tpl.firstElementChild.outerHTML);
  win.document.close();

  win.addEventListener('load', ()=>{
    const b = win.document.body;
    const derived = isOverdue(inv) ? 'Overdue' : inv.status;
    b.innerHTML = `
      <div class="head">
        <div class="brand">KhataFlow</div>
        <div><span class="badge">${derived}</span></div>
      </div>
      <div>
        <div><strong>Client:</strong> ${escape(inv.client)}</div>
        <div><strong>Category:</strong> ${escape(inv.category || '')}</div>
        <div class="muted">Issue: ${inv.issueDate} &nbsp;&nbsp; Due: ${inv.dueDate}</div>
        <div class="muted">Notes: ${escape(inv.notes || '')}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <tr><td>${escape(inv.category || 'Service')}</td><td class="right">${fmtINR(inv.amount)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td class="total">Total</td><td class="right total">${fmtINR(inv.amount)}</td></tr>
        </tfoot>
      </table>
    `;
    win.print();
    setTimeout(()=>win.close(), 300);
  });
}

// ----- Import helpers -----
function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const head = splitCSV(lines.shift());
  const idx = Object.fromEntries(head.map((h,i)=>[h,i]));
  const req = ['client','amount','issueDate','dueDate','status'];
  req.forEach(k=>{ if (!(k in idx)) throw new Error(`Missing column ${k}`); });

  const arr = lines.map(line=>{
    const cells = splitCSV(line);
    return {
      id: cells[idx.id] || uid(),
      client: cells[idx.client],
      category: cells[idx.category] || '',
      amount: Number(cells[idx.amount] || 0),
      issueDate: cells[idx.issueDate],
      dueDate: cells[idx.dueDate],
      status: cells[idx.status],
      notes: cells[idx.notes] || ''
    };
  });
  return normalizeImported(arr);
}
function splitCSV(line){
  const out=[]; let cur=''; let inQ=false;
  for (let i=0;i<line.length;i++){
    const ch=line[i];
    if (ch === '"' ){ if (inQ && line[i+1] === '"'){ cur+='"'; i++; } else inQ=!inQ; continue; }
    if (ch === ',' && !inQ){ out.push(cur); cur=''; continue; }
    cur+=ch;
  }
  out.push(cur);
  return out;
}
function normalizeImported(arr){
  return arr.map(i=>({
    id: i.id || uid(),
    client: String(i.client || '').trim(),
    category: String(i.category || '').trim(),
    amount: Number(i.amount || 0),
    issueDate: (i.issueDate || todayISO()).slice(0,10),
    dueDate: (i.dueDate || i.issueDate || todayISO()).slice(0,10),
    status: (i.status === 'Paid' ? 'Paid' : 'Pending'),
    notes: String(i.notes || '').trim()
  }));
}
function downloadFile(name, type, text){
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Initial render
render();

// Resize chart on window resize (debounced)
let t;
window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(drawChart, 120); });
