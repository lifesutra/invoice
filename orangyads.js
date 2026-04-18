import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ── DOM refs ──
const form          = document.getElementById("oa-form");
const itemsCont     = document.getElementById("oa-items-container");
const addItemBtn    = document.getElementById("oa-add-item");
const itemTpl       = document.getElementById("oa-item-tpl");
const totalDisp     = document.getElementById("oa-total-disp");
const wordsDisp     = document.getElementById("oa-words-disp");
const resetBtn      = document.getElementById("oa-reset");
const previewBtn    = document.getElementById("oa-preview-btn");
const dialog        = document.getElementById("oa-dialog");
const dialogClose   = document.getElementById("oa-dialog-close");
const previewSheet  = document.getElementById("oa-preview-sheet");
const companyToggle = document.getElementById("oa-company-toggle");
const companyBody   = document.getElementById("oa-company-body");
const dateInput     = document.getElementById("oa-date");

const STORAGE_KEY = "oa-invoice-draft";

// ── Indian number words ──
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function twoDigit(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n/10)] + (n%10 ? ' ' + ONES[n%10] : '');
}

function threeDigit(n) {
  if (n === 0) return '';
  const h = Math.floor(n/100), r = n%100;
  return (h ? ONES[h] + ' Hundred' : '') + (r ? (h?' ':'')+twoDigit(r) : '');
}

function indianWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero Rupees Only';
  let res = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh  = Math.floor(n / 100000);   n %= 100000;
  const thou  = Math.floor(n / 1000);     n %= 1000;
  if (crore) res += twoDigit(crore)  + ' Crore ';
  if (lakh)  res += twoDigit(lakh)   + ' Lakh ';
  if (thou)  res += twoDigit(thou)   + ' Thousand ';
  if (n)     res += threeDigit(n)    + ' ';
  return res.trim() + ' Rupees Only';
}

function formatRs(n) { return 'Rs.' + Math.round(n) + '/-'; }
function formatRsTotal(n) { return 'Rs. ' + Math.round(n) + '/-'; }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

// ── Items ──
function getItems() { return Array.from(itemsCont.querySelectorAll('[data-oa-item]')); }

function renumberItems() {
  getItems().forEach(function(row, i) {
    const num = row.querySelector('.oa-item-num');
    if (num) num.textContent = (i + 1) + ')';
  });
}

function recalcTotal() {
  let total = 0;
  getItems().forEach(function(row) {
    const v = parseFloat(row.querySelector('.oa-amt').value) || 0;
    total += v;
  });
  total = Math.round(total);
  totalDisp.textContent = formatRsTotal(total);
  wordsDisp.textContent = 'Amount in words: ' + indianWords(total);
  return total;
}

function bindItem(row) {
  row.querySelector('.oa-amt').addEventListener('input', recalcTotal);
  const del = row.querySelector('[data-oa-remove]');
  if (del) {
    del.addEventListener('click', function() {
      if (getItems().length <= 1) return;
      row.remove();
      renumberItems();
      recalcTotal();
      scheduleSave();
    });
  }
}

function addItem(data) {
  const node = itemTpl.content.cloneNode(true);
  const row  = node.querySelector('[data-oa-item]');
  if (data) {
    const d = row.querySelector('.oa-desc');
    const a = row.querySelector('.oa-amt');
    if (d && data.desc != null) d.value = data.desc;
    if (a && data.amt  != null) a.value = data.amt;
  }
  itemsCont.appendChild(node);
  bindItem(itemsCont.lastElementChild);
  renumberItems();
  recalcTotal();
}

addItemBtn.addEventListener('click', function() { addItem(); scheduleSave(); });

// ── Company toggle ──
companyToggle.addEventListener('click', function() {
  const open = companyBody.hidden;
  companyBody.hidden = !open;
  companyToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// ── Draft persistence ──
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 300);
}

function getFormValues() {
  return {
    address:   document.getElementById('oa-address').value,
    pan:       document.getElementById('oa-pan').value,
    signatory: document.getElementById('oa-signatory').value,
    website:   document.getElementById('oa-website').value,
    invNo:     document.getElementById('oa-inv-no').value,
    date:      document.getElementById('oa-date').value,
    toName:    document.getElementById('oa-to-name').value,
    toProject: document.getElementById('oa-to-project').value,
    toCity:    document.getElementById('oa-to-city').value,
    terms:     document.getElementById('oa-terms').value,
    items: getItems().map(function(r) {
      return { desc: r.querySelector('.oa-desc').value, amt: r.querySelector('.oa-amt').value };
    }),
  };
}

function saveDraft() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormValues())); } catch(e) {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    set('oa-address',    d.address);
    set('oa-pan',        d.pan);
    set('oa-signatory',  d.signatory);
    set('oa-website',    d.website);
    set('oa-inv-no',     d.invNo);
    set('oa-date',       d.date || todayISO());
    set('oa-to-name',    d.toName);
    set('oa-to-project', d.toProject);
    set('oa-to-city',    d.toCity);
    set('oa-terms',      d.terms);
    if (Array.isArray(d.items) && d.items.length) {
      d.items.forEach(function(it) { addItem(it); });
    } else {
      addItem();
    }
    recalcTotal();
    return true;
  } catch(e) { return false; }
}

const DEFAULT_TERMS = `1) Payment should be done in the Name of "Orangy Ads"
2) 100% Payment in advance.
3) For Month of November, December 2025 and January 2026.`;

function resetForm() {
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById('oa-address').value   = '686, Shop no - 3,\nShridhar Nilay Apts,\nBibwewadi - 411037';
  document.getElementById('oa-pan').value        = 'AVAPK3287C';
  document.getElementById('oa-signatory').value  = 'Nilesh Kothari';
  document.getElementById('oa-website').value    = 'www.orangyads.com';
  document.getElementById('oa-inv-no').value     = '';
  document.getElementById('oa-date').value       = todayISO();
  document.getElementById('oa-to-name').value    = '';
  document.getElementById('oa-to-project').value = '';
  document.getElementById('oa-to-city').value    = '';
  document.getElementById('oa-terms').value      = DEFAULT_TERMS;
  itemsCont.replaceChildren();
  addItem();
  recalcTotal();
}

resetBtn.addEventListener('click', function() {
  if (!confirm('Reset all fields to defaults?')) return;
  resetForm();
});

form.addEventListener('input',  scheduleSave);
form.addEventListener('change', scheduleSave);

// ── Preview HTML ──
function buildPreviewHtml() {
  const v = getFormValues();
  const total = getItems().reduce(function(s, r) { return s + (parseFloat(r.querySelector('.oa-amt').value)||0); }, 0);
  const totalInt = Math.round(total);

  const toLines = ['<strong>To,</strong>', escHtml(v.toName)];
  if (v.toProject) toLines.push('Project - ' + escHtml(v.toProject));
  if (v.toCity)    toLines.push(escHtml(v.toCity));

  const itemRows = getItems().map(function(r, i) {
    const desc = r.querySelector('.oa-desc').value;
    const amt  = parseFloat(r.querySelector('.oa-amt').value) || 0;
    return `<tr>
      <td class="oa-td-particulars">${escHtml((i+1)+') '+desc)}</td>
      <td class="oa-td-rate">${escHtml(formatRs(amt))}</td>
    </tr>`;
  }).join('');

  return `
  <div class="oa-sheet">
    <div class="oa-swoosh-bl"></div>
    <div class="oa-swoosh-br"></div>
    <div class="oa-sheet-inner">
      <div class="oa-inv-header">
        <img src="./orangyads-logo.png" class="oa-inv-logo" alt="OrangyAds" />
        <div class="oa-inv-addr">${escHtml(v.address).replace(/\n/g,'<br>')}</div>
      </div>
      <hr class="oa-inv-divider" />
      <div class="oa-inv-title">INVOICE</div>
      <div class="oa-inv-date">Date - ${escHtml(formatDate(v.date))}</div>
      <div class="oa-inv-to-row">
        <div class="oa-inv-to">${toLines.join('<br>')}</div>
        <div class="oa-inv-invno">Invoice no : &nbsp;${escHtml(v.invNo)}</div>
      </div>
      <table class="oa-inv-table">
        <thead>
          <tr><th>Particulars</th><th>Rate</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr class="oa-tr-total">
            <td style="text-align:right"><strong>Total</strong></td>
            <td class="oa-td-rate"><strong>${escHtml(formatRsTotal(totalInt))}</strong></td>
          </tr>
          <tr class="oa-tr-words">
            <td colspan="2"><strong>Amount (in words) :</strong> ${escHtml(indianWords(totalInt))}</td>
          </tr>
        </tfoot>
      </table>
      <div class="oa-inv-terms">
        <span class="oa-inv-terms-head">Terms &amp; Conditions -</span>${escHtml(v.terms)}
      </div>
      <div class="oa-inv-pan">PAN NO:<br>${escHtml(v.pan)}</div>
      <div class="oa-inv-footer">
        <div>
          <div class="oa-inv-signatory">
            <strong>Authorised Signatory :</strong><br>${escHtml(v.signatory)}
          </div>
          <div class="oa-inv-website">${escHtml(v.website)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Preview dialog ──
previewBtn.addEventListener('click', function() {
  if (!form.reportValidity()) return;
  previewSheet.innerHTML = buildPreviewHtml();
  dialog.showModal();
});

dialogClose.addEventListener('click', function() { dialog.close(); });
dialog.addEventListener('click', function(e) { if (e.target === dialog) dialog.close(); });

// ── PDF generation ──
async function generatePDF() {
  const v = getFormValues();
  const items = getItems().map(function(r) {
    return {
      desc: r.querySelector('.oa-desc').value.trim(),
      amt:  Math.round(parseFloat(r.querySelector('.oa-amt').value) || 0),
    };
  });
  const total = items.reduce(function(s, it) { return s + it.amt; }, 0);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const orange = [244, 121, 32];

  // ── Orange swoosh decorations ──
  doc.setFillColor(...orange);
  doc.ellipse(pageW + 8,  -12, 44, 58, 'F');   // top-right
  doc.ellipse(-10, pageH + 10, 28, 36, 'F');   // bottom-left
  doc.ellipse(pageW + 10, pageH + 10, 28, 36, 'F'); // bottom-right

  // ── Logo ──
  try {
    const resp = await fetch('./orangyads-logo.png');
    const blob = await resp.blob();
    const logoDataUrl = await new Promise(function(resolve) {
      const reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.readAsDataURL(blob);
    });
    doc.addImage(logoDataUrl, 'PNG', margin, 8, 46, 20);
  } catch(e) {}

  // ── Address top-right ──
  const addrLines = v.address.split('\n');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(50, 50, 50);
  let ay = 13;
  addrLines.forEach(function(line) {
    doc.text(line.trim(), pageW - margin, ay, { align: 'right' });
    ay += 5;
  });

  // ── Divider ──
  let y = 32;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── INVOICE title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('INVOICE', pageW / 2, y, { align: 'center' });
  y += 8;

  // ── Date ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('Date - ' + formatDate(v.date), pageW - margin, y, { align: 'right' });
  y += 7;

  // ── To section ──
  const toLines = ['To,', v.toName];
  if (v.toProject) toLines.push('Project - ' + v.toProject);
  if (v.toCity)    toLines.push(v.toCity);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  toLines.forEach(function(line, i) {
    if (i === 1) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    doc.text(line, margin, y);
    y += 5;
  });

  // ── Invoice no (right-aligned, same area as To) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const invNoY = y - (toLines.length * 5) + 5;
  doc.text('Invoice no :  ' + v.invNo, pageW - margin, invNoY + (toLines.length * 5) - 8, { align: 'right' });
  y += 4;

  // ── Items table ──
  const col1W = 120;
  const col2W = 180 - col1W;
  const bodyRows = items.map(function(it, i) {
    return [{ content: (i+1)+') '+it.desc, styles: { halign: 'center', valign: 'middle' } },
            { content: formatRs(it.amt), styles: { halign: 'center', valign: 'middle' } }];
  });

  const footRows = [
    [
      { content: 'Total', styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } },
      { content: formatRsTotal(total), styles: { halign: 'center', fontStyle: 'bold', fontSize: 11 } },
    ],
    [
      { content: 'Amount (in words) : ' + indianWords(total), colSpan: 2, styles: { halign: 'center', fontSize: 9, fontStyle: 'normal' } },
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Particulars', styles: { halign: 'center' } },
      { content: 'Rate', styles: { halign: 'center' } },
    ]],
    body: bodyRows,
    foot: footRows,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 12,
      lineColor: [80, 80, 80],
      lineWidth: 0.5,
      minCellHeight: 8,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 30, 30],
      fontSize: 10,
      lineColor: [100, 100, 100],
      lineWidth: 0.3,
      minCellHeight: 18,
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 30, 30],
      fontSize: 9.5,
      lineColor: [100, 100, 100],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: col1W },
      1: { cellWidth: col2W },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 7;

  // ── Terms & Conditions ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text('Terms & Conditions -', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const termsLines = doc.splitTextToSize(v.terms, pageW - 2 * margin);
  doc.text(termsLines, margin, y);
  y += termsLines.length * 4.5 + 6;

  // ── PAN ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text('PAN NO:', margin + 4, y);
  y += 5;
  doc.text(v.pan, margin + 4, y);
  y += 8;

  // ── Authorised Signatory ──
  const sigY = Math.max(y + 10, pageH - 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Authorised Signatory :', pageW - margin, sigY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(v.signatory, pageW - margin, sigY + 6, { align: 'right' });

  // ── Website ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(v.website, pageW - margin, sigY + 14, { align: 'right' });

  const safe = (v.invNo || 'invoice').replace(/[^\w\-]+/g, '_');
  doc.save('orangyads-invoice-' + safe + '.pdf');
}

// ── Form submit ──
form.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!form.reportValidity()) return;
  await generatePDF();
});

// ── Link from main page ──
// Add OrangyAds quick link card on index.html is handled separately

// ── Init ──
if (!loadDraft()) {
  if (dateInput) dateInput.value = todayISO();
  addItem();
}
