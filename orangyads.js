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

  const toBlock = [
    '<span class="oa-inv-to-name">' + escHtml(v.toName) + '</span>',
  ];
  if (v.toProject) toBlock.push('Project — ' + escHtml(v.toProject));
  if (v.toCity)    toBlock.push(escHtml(v.toCity));

  const itemRows = getItems().map(function(r, i) {
    const desc = r.querySelector('.oa-desc').value;
    const amt  = parseFloat(r.querySelector('.oa-amt').value) || 0;
    return `<tr>
      <td class="oa-td-particulars">${escHtml((i+1) + ')  ' + desc)}</td>
      <td class="oa-td-rate">${escHtml(formatRs(amt))}</td>
    </tr>`;
  }).join('');

  return `
  <div class="oa-sheet">

    <!-- ▸ Split header: white logo left · orange info right -->
    <div class="oa-inv-header-band">
      <div class="oa-inv-header-logo-wrap">
        <img src="./orgadsclearlogo.png" class="oa-inv-logo" alt="OrangyAds" />
      </div>
      <div class="oa-inv-header-info-wrap">
        <div class="oa-inv-brand-tag">Digital Marketing Solutions</div>
        <div class="oa-inv-addr-top">${escHtml(v.address).replace(/\n/g,'<br>')}</div>
      </div>
    </div>

    <!-- ▸ Divider line below header -->
    <div style="height:2px;background:linear-gradient(to right,#f47920 0%,#ffa040 50%,#f0f0f0 100%);margin:0 1.75rem;border-radius:2px;"></div>

    <!-- ▸ Body -->
    <div class="oa-sheet-body">

      <!-- Title + invoice meta -->
      <div class="oa-inv-title-row">
        <div class="oa-inv-title">INV<span>OICE</span></div>
        <div class="oa-inv-meta">
          <div class="oa-inv-meta-no">#&thinsp;${escHtml(v.invNo)}</div>
          <div>Date &nbsp;·&nbsp; ${escHtml(formatDate(v.date))}</div>
        </div>
      </div>

      <!-- Bill to -->
      <div class="oa-inv-to-section">
        <div class="oa-inv-to-label">Bill To</div>
        ${toBlock.join('<br>')}
      </div>

      <!-- Particulars table -->
      <table class="oa-inv-table">
        <thead>
          <tr>
            <th style="text-align:left;padding-left:0.85rem">Particulars</th>
            <th style="width:28%">Rate</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr class="oa-tr-total">
            <td class="oa-total-label-cell">Total Amount</td>
            <td class="oa-td-rate">${escHtml(formatRsTotal(totalInt))}</td>
          </tr>
          <tr class="oa-tr-words">
            <td colspan="2"><em>In words :</em>&ensp;${escHtml(indianWords(totalInt))}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Terms + PAN -->
      <div class="oa-inv-bottom-row">
        <div class="oa-inv-terms">
          <span class="oa-inv-terms-head">Terms &amp; Conditions</span>${escHtml(v.terms)}
        </div>
        <div class="oa-inv-pan-box">
          <span class="oa-inv-pan-label">PAN No.</span>
          ${escHtml(v.pan)}
        </div>
      </div>

      <!-- Footer -->
      <div class="oa-inv-footer">
        <div class="oa-inv-footer-tagline">OrangyAds &nbsp;·&nbsp; Digital Marketing Solutions</div>
        <div>
          <div class="oa-inv-signatory">
            <strong>Authorised Signatory</strong><br>${escHtml(v.signatory)}
          </div>
          <div class="oa-inv-website">${escHtml(v.website)}</div>
        </div>
      </div>

    </div>

    <!-- ▸ Bottom wave accent -->
    <svg class="oa-inv-bottom-wave" viewBox="0 0 600 22" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" height="22" aria-hidden="true">
      <path d="M0,22 C100,4 200,18 320,10 C440,2 520,16 600,8 L600,22 Z" fill="#f47920" opacity="0.18"/>
      <path d="M0,22 C90,8 200,20 310,12 C420,4 510,18 600,10 L600,22 Z" fill="#f47920" opacity="0.35"/>
      <path d="M0,22 C80,12 190,22 300,14 C410,6 500,20 600,12 L600,22 Z" fill="#f47920" opacity="0.65"/>
      <path d="M0,22 C70,16 180,22 290,16 C400,10 490,22 600,16 L600,22 Z" fill="#f47920"/>
    </svg>

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
  const mg    = 15;
  const orange  = [244, 121, 32];
  const dkOrange= [196, 68,  0];
  const navy    = [26,  26,  46];
  const white   = [255, 255, 255];

  // ── HEADER: no background — logo left, address right ──
  const headerH = 28;

  // ── LOGO ──
  try {
    const resp = await fetch('./orgadsclearlogo.png');
    const blob = await resp.blob();
    const logoDataUrl = await new Promise(function(res) {
      const rd = new FileReader();
      rd.onload = function(e) { res(e.target.result); };
      rd.readAsDataURL(blob);
    });
    doc.addImage(logoDataUrl, 'PNG', mg, 5, 44, 18);
  } catch(e) {}

  // ── BRAND TAG ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...orange);
  doc.text('DIGITAL MARKETING SOLUTIONS', pageW - mg, 9, { align: 'right' });

  // ── ADDRESS ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let ay = 14;
  v.address.split('\n').forEach(function(line) {
    doc.text(line.trim(), pageW - mg, ay, { align: 'right' });
    ay += 4;
  });

  // ── Gradient divider line ──
  doc.setDrawColor(...orange);
  doc.setLineWidth(0.7);
  doc.line(mg, headerH, pageW * 0.55, headerH);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(pageW * 0.55, headerH, pageW - mg, headerH);

  let y = headerH + 10;

  // ── INVOICE TITLE + NUMBER (two-tone: INV dark · OICE orange) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...navy);
  doc.text('INV', mg, y);
  const invW = doc.getTextWidth('INV');
  doc.setTextColor(...orange);
  doc.text('OICE', mg + invW, y);

  // Invoice # (right)
  doc.setFontSize(11);
  doc.setTextColor(...orange);
  doc.text('# ' + v.invNo, pageW - mg, y - 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text('Date  \u00B7  ' + formatDate(v.date), pageW - mg, y + 3, { align: 'right' });

  y += 4;

  // ── Thin orange rule ──
  doc.setDrawColor(...orange);
  doc.setLineWidth(0.6);
  doc.line(mg, y, pageW - mg, y);
  y += 7;

  // ── BILL TO box ──
  const billToLines = [v.toName];
  if (v.toProject) billToLines.push('Project — ' + v.toProject);
  if (v.toCity)    billToLines.push(v.toCity);
  const billBoxH = 5 + billToLines.length * 4.8 + 4;

  doc.setFillColor(255, 249, 243);
  doc.setDrawColor(...orange);
  doc.setLineWidth(0);
  doc.roundedRect(mg, y, pageW - 2 * mg, billBoxH, 2, 2, 'F');
  doc.setFillColor(...orange);
  doc.roundedRect(mg, y, 2, billBoxH, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...orange);
  doc.text('BILL TO', mg + 6, y + 4);
  let by = y + 9;
  billToLines.forEach(function(line, i) {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    doc.setFontSize(i === 0 ? 10 : 8.5);
    doc.setTextColor(i === 0 ? 20 : 80, i === 0 ? 20 : 80, i === 0 ? 20 : 80);
    doc.text(line, mg + 6, by);
    by += 4.8;
  });
  y += billBoxH + 7;

  // ── ITEMS TABLE ──
  const col1W = 130, col2W = pageW - 2 * mg - col1W;
  const bodyRows = items.map(function(it, i) {
    return [
      { content: (i + 1) + ')  ' + it.desc, styles: { halign: 'left', valign: 'middle' } },
      { content: formatRs(it.amt), styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Particulars', styles: { halign: 'left' } },
      { content: 'Rate',        styles: { halign: 'center' } },
    ]],
    body: bodyRows,
    foot: [
      [
        { content: 'TOTAL AMOUNT', styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, fillColor: white, textColor: navy, lineColor: [230, 210, 195], lineWidth: 0.25 } },
        { content: formatRsTotal(total), styles: { halign: 'center', fontStyle: 'bold', fontSize: 13, fillColor: navy, textColor: [255, 169, 77], lineWidth: 0 } },
      ],
      [
        { content: 'In words :  ' + indianWords(total), colSpan: 2, styles: { halign: 'center', fontSize: 8, fontStyle: 'italic', fillColor: [253, 246, 239], textColor: [100, 100, 120], lineColor: [230, 210, 195], lineWidth: 0.25 } },
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: orange,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 10.5,
      lineWidth: 0,
      minCellHeight: 9,
    },
    bodyStyles: {
      fillColor: white,
      textColor: [30, 30, 30],
      fontSize: 9.5,
      lineColor: [230, 210, 195],
      lineWidth: 0.25,
      minCellHeight: 16,
    },
    alternateRowStyles: { fillColor: [253, 246, 239] },
    footStyles: {
      fillColor: white,
      textColor: navy,
      fontSize: 9,
      lineWidth: 0,
      minCellHeight: 9,
    },
    columnStyles: {
      0: { cellWidth: col1W },
      1: { cellWidth: col2W },
    },
    margin: { left: mg, right: mg },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── TERMS (left) + PAN box (right) ──
  const termsText = doc.splitTextToSize(v.terms, pageW - 2 * mg - 45);
  const panBoxW = 40, panBoxH = 16;
  const panBoxX = pageW - mg - panBoxW;

  doc.setFillColor(247, 247, 249);
  doc.setDrawColor(220, 220, 228);
  doc.setLineWidth(0.3);
  doc.roundedRect(panBoxX, y, panBoxW, panBoxH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(170, 170, 180);
  doc.text('PAN NO.', panBoxX + panBoxW / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  doc.text(v.pan, panBoxX + panBoxW / 2, y + 12, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...orange);
  doc.text('TERMS & CONDITIONS', mg, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 90);
  doc.text(termsText, mg, y + 9);

  y = Math.max(y + panBoxH + 6, y + termsText.length * 3.8 + 14);

  // ── FOOTER ──
  const footY = Math.max(y, pageH - 28);

  doc.setDrawColor(240, 228, 216);
  doc.setLineWidth(0.4);
  doc.line(mg, footY, pageW - mg, footY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 200, 210);
  doc.text('ORANGYADS  ·  DIGITAL MARKETING SOLUTIONS', mg, footY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...navy);
  doc.text('Authorised Signatory', pageW - mg, footY + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(v.signatory, pageW - mg, footY + 11, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...orange);
  doc.text(v.website, pageW - mg, footY + 17, { align: 'right' });

  // ── Bottom wave accent bars ──
  const bwY = pageH - 4;
  doc.setFillColor(...orange);
  doc.setDrawColor(...orange);
  doc.lines(
    [
      [pageW * 0.22, -3.5, pageW * 0.28, -3.5, pageW * 0.5, -1.5],
      [pageW * 0.22,  1.5, pageW * 0.28,  3.5, pageW * 0.5,  1.5],
      [0, 4], [-pageW, 0],
    ],
    0, bwY, [1,1], 'F', true
  );

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
