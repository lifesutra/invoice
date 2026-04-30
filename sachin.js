import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const form        = document.getElementById("sv-form");
const itemsCont   = document.getElementById("sv-items-container");
const addItemBtn  = document.getElementById("sv-add-item");
const itemTpl     = document.getElementById("sv-item-tpl");
const totalDisp   = document.getElementById("sv-total-disp");
const wordsDisp   = document.getElementById("sv-words-disp");
const resetBtn    = document.getElementById("sv-reset");
const previewBtn  = document.getElementById("sv-preview-btn");
const dialog      = document.getElementById("sv-dialog");
const dialogClose = document.getElementById("sv-dialog-close");
const previewSheet= document.getElementById("sv-preview-sheet");
const storeToggle = document.getElementById("sv-store-toggle");
const storeBody   = document.getElementById("sv-store-body");
const dateInput   = document.getElementById("sv-date");

const STORAGE_KEY = "sv-invoice-draft";

// Indian number words
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function twoDigit(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n/10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function threeDigit(n) {
  if (n === 0) return '';
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ONES[h] + ' Hundred' : '') + (r ? (h ? ' ' : '') + twoDigit(r) : '');
}

function indianWords(n) {
  n = Math.round(Math.abs(n));
  if (n === 0) return 'Zero only';
  let res = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh  = Math.floor(n / 100000);   n %= 100000;
  const thou  = Math.floor(n / 1000);     n %= 1000;
  if (crore) res += twoDigit(crore) + ' Crore ';
  if (lakh)  res += twoDigit(lakh)  + ' Lakh ';
  if (thou)  res += twoDigit(thou)  + ' Thousand ';
  if (n)     res += threeDigit(n)   + ' ';
  return res.trim() + ' only';
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// Items
function getItems() { return Array.from(itemsCont.querySelectorAll('[data-sv-item]')); }

function renumberItems() {
  getItems().forEach(function(row, i) {
    const num = row.querySelector('.sv-item-num');
    if (num) num.textContent = (i + 1) + '.';
  });
}

function calcLineAmt(row) {
  const qty   = parseFloat(row.querySelector('.sv-qty').value)   || 0;
  const price = parseFloat(row.querySelector('.sv-price').value) || 0;
  return qty * price;
}

function recalcAll() {
  let total = 0;
  getItems().forEach(function(row) {
    const amt = calcLineAmt(row);
    total += amt;
    const amtEl = row.querySelector('.sv-amt');
    if (amtEl) amtEl.value = fmtAmt(amt);
  });
  totalDisp.textContent = '₹ ' + fmtAmt(total);
  wordsDisp.textContent = 'In words: ' + indianWords(total);
  return total;
}

function bindItem(row) {
  row.querySelector('.sv-qty').addEventListener('input', recalcAll);
  row.querySelector('.sv-price').addEventListener('input', recalcAll);
  const del = row.querySelector('[data-sv-remove]');
  if (del) {
    del.addEventListener('click', function() {
      if (getItems().length <= 1) return;
      row.remove();
      renumberItems();
      recalcAll();
      scheduleSave();
    });
  }
}

function addItem(data) {
  const node = itemTpl.content.cloneNode(true);
  const row  = node.querySelector('[data-sv-item]');
  if (data) {
    const descEl  = row.querySelector('.sv-desc');
    const qtyEl   = row.querySelector('.sv-qty');
    const unitEl  = row.querySelector('.sv-unit');
    const priceEl = row.querySelector('.sv-price');
    if (descEl  && data.desc  != null) descEl.value  = data.desc;
    if (qtyEl   && data.qty   != null) qtyEl.value   = data.qty;
    if (unitEl  && data.unit  != null) unitEl.value  = data.unit;
    if (priceEl && data.price != null) priceEl.value = data.price;
  }
  itemsCont.appendChild(node);
  bindItem(itemsCont.lastElementChild);
  renumberItems();
  recalcAll();
}

addItemBtn.addEventListener('click', function() { addItem(); scheduleSave(); });

storeToggle.addEventListener('click', function() {
  const open = storeBody.hidden;
  storeBody.hidden = !open;
  storeToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// Draft persistence
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 300);
}

function getFormValues() {
  return {
    storeName: document.getElementById('sv-store-name').value,
    address:   document.getElementById('sv-address').value,
    toName:    document.getElementById('sv-to-name').value,
    invNo:     document.getElementById('sv-inv-no').value,
    date:      document.getElementById('sv-date').value,
    items: getItems().map(function(r) {
      return {
        desc:  r.querySelector('.sv-desc').value,
        qty:   r.querySelector('.sv-qty').value,
        unit:  r.querySelector('.sv-unit').value,
        price: r.querySelector('.sv-price').value,
      };
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
    set('sv-store-name', d.storeName);
    set('sv-address',    d.address);
    set('sv-to-name',    d.toName);
    set('sv-inv-no',     d.invNo);
    set('sv-date',       d.date || todayISO());
    if (Array.isArray(d.items) && d.items.length) {
      d.items.forEach(function(it) { addItem(it); });
    } else {
      loadDefaultItems();
    }
    recalcAll();
    return true;
  } catch(e) { return false; }
}

const DEFAULT_TO_NAME = 'Isha Institute of Inner Sciences, Isha yoga centre, Velliangiri foothills, Ishana vihar post, coimbatore 641114';

const DEFAULT_ITEMS = [
  { desc: 'Ashgaurd',          qty: 14,  unit: 'KGS',   price: 50    },
  { desc: 'Carrot',            qty: 5,   unit: 'KGS',   price: 60    },
  { desc: 'Beetroot',          qty: 5,   unit: 'KGS',   price: 60    },
  { desc: 'Snake Gourd',       qty: 8,   unit: 'KGS',   price: 100   },
  { desc: 'Tomato',            qty: 1.5, unit: 'KGS',   price: 34    },
  { desc: 'Capsicum',          qty: 3,   unit: 'KGS',   price: 80    },
  { desc: 'Ginger',            qty: 1.5, unit: 'KGS',   price: 100   },
  { desc: 'Lemon',             qty: 70,  unit: 'NOS',   price: 5.70  },
  { desc: 'Coriander',         qty: 4,   unit: 'Bunch', price: 25    },
  { desc: 'Curry Leave',       qty: 3,   unit: 'Bunch', price: 17    },
  { desc: 'Bannana Leaves',    qty: 150, unit: 'NOS',   price: 8     },
  { desc: 'Bannana',           qty: 12,  unit: 'DOZ',   price: 60    },
  { desc: 'Papaya',            qty: 3,   unit: 'NOS',   price: 117   },
  { desc: 'Apple',             qty: 5,   unit: 'KGS',   price: 280   },
  { desc: 'Pomegranate',       qty: 3,   unit: 'KGS',   price: 260   },
  { desc: 'Pear',              qty: 4,   unit: 'KGS',   price: 140   },
  { desc: 'Grapes',            qty: 2,   unit: 'KGS',   price: 100   },
  { desc: 'Coconut',           qty: 4,   unit: 'NOS',   price: 50    },
  { desc: 'Mango',             qty: 2,   unit: 'KGS',   price: 180   },
  { desc: 'Transport Charges', qty: 1,   unit: 'NOS',   price: 200   },
];

function loadDefaultItems() {
  DEFAULT_ITEMS.forEach(function(it) { addItem(it); });
}

function resetForm() {
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById('sv-store-name').value = 'SACHIN VEGITABLE STORE';
  document.getElementById('sv-address').value    = 'Kanderaya Bhaji Mandal, Viveknagar, Akurdi, Pune - 411035';
  document.getElementById('sv-to-name').value    = DEFAULT_TO_NAME;
  document.getElementById('sv-inv-no').value     = '';
  document.getElementById('sv-date').value       = todayISO();
  itemsCont.replaceChildren();
  loadDefaultItems();
  recalcAll();
}

resetBtn.addEventListener('click', function() {
  if (!confirm('Reset all fields to defaults?')) return;
  resetForm();
});

form.addEventListener('input',  scheduleSave);
form.addEventListener('change', scheduleSave);

// Preview HTML
function buildPreviewHtml() {
  const v = getFormValues();
  const items = getItems().map(function(r) {
    const qty   = parseFloat(r.querySelector('.sv-qty').value)   || 0;
    const price = parseFloat(r.querySelector('.sv-price').value) || 0;
    return {
      desc:  r.querySelector('.sv-desc').value,
      qty,
      unit:  r.querySelector('.sv-unit').value,
      price,
      amt:   qty * price,
    };
  });
  const total = items.reduce(function(s, it) { return s + it.amt; }, 0);

  const itemRows = items.map(function(it) {
    return `<tr>
      <td class="sv-td-desc">${escHtml(it.desc)}</td>
      <td class="sv-td-qty">${escHtml(String(it.qty))} ${escHtml(it.unit)}</td>
      <td class="sv-td-uprice">${fmtAmt(it.price)} / ${escHtml(it.unit)}</td>
      <td class="sv-td-amt">${fmtAmt(it.amt)}</td>
    </tr>`;
  }).join('');

  return `
  <div class="sv-sheet">
    <div class="sv-sheet-header">
      <div class="sv-sheet-inv-title">INVOICE</div>
      <div class="sv-sheet-store-name">${escHtml(v.storeName)}</div>
      <div class="sv-sheet-store-addr">${escHtml(v.address)}</div>
    </div>

    <div class="sv-sheet-meta">
      <div class="sv-sheet-to">
        <div class="sv-sheet-to-label">Name</div>
        <div class="sv-sheet-to-name">${escHtml(v.toName)}</div>
      </div>
      <div class="sv-sheet-inv-meta">
        <div class="sv-sheet-inv-no">Invoice ${escHtml(v.invNo)}</div>
        <div>Date&nbsp;&nbsp;${escHtml(formatDate(v.date))}</div>
      </div>
    </div>

    <div class="sv-sheet-body">
      <table class="sv-inv-table">
        <thead>
          <tr>
            <th style="width:36%;text-align:left;padding-left:0.75rem">Description</th>
            <th style="width:17%">Qty</th>
            <th style="width:26%">Unit price / unit</th>
            <th style="width:21%;text-align:right;padding-right:0.75rem">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr class="sv-tr-total">
            <td colspan="3" class="sv-td-total-label">Total:</td>
            <td class="sv-td-total-amt">${fmtAmt(total)}</td>
          </tr>
          <tr class="sv-tr-words">
            <td colspan="4">In words: ${escHtml(indianWords(total))}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="sv-sheet-footer">
      <div class="sv-sheet-footer-sig">
        <strong>For ${escHtml(v.storeName)}</strong>
        <span>Authorised Signatory</span>
      </div>
    </div>
  </div>`;
}

// Preview dialog
previewBtn.addEventListener('click', function() {
  if (!form.reportValidity()) return;
  previewSheet.innerHTML = buildPreviewHtml();
  dialog.showModal();
});

dialogClose.addEventListener('click', function() { dialog.close(); });
dialog.addEventListener('click', function(e) { if (e.target === dialog) dialog.close(); });

// PDF generation
async function generatePDF() {
  const v = getFormValues();
  const items = getItems().map(function(r) {
    const qty   = parseFloat(r.querySelector('.sv-qty').value)   || 0;
    const price = parseFloat(r.querySelector('.sv-price').value) || 0;
    return {
      desc:  r.querySelector('.sv-desc').value.trim(),
      qty,
      unit:  r.querySelector('.sv-unit').value,
      price,
      amt:   qty * price,
    };
  });
  const total = items.reduce(function(s, it) { return s + it.amt; }, 0);

  const doc    = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const mg     = 15;
  const green      = [46, 125, 50];
  const darkGreen  = [27, 94, 32];
  const lightGreen = [232, 245, 233];
  const white      = [255, 255, 255];
  const nearBlack  = [26, 26, 26];

  // ── INVOICE heading ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...nearBlack);
  doc.text('INVOICE', pageW / 2, 15, { align: 'center' });

  // Store name
  doc.setFontSize(12);
  doc.setTextColor(...green);
  doc.text(v.storeName, pageW / 2, 22, { align: 'center' });

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const addrLines = doc.splitTextToSize(v.address, pageW - 2 * mg - 20);
  doc.text(addrLines, pageW / 2, 27, { align: 'center' });

  const afterAddr = 27 + addrLines.length * 3.5;

  // Divider
  doc.setDrawColor(...green);
  doc.setLineWidth(0.7);
  doc.line(mg, afterAddr + 2, pageW - mg, afterAddr + 2);

  let y = afterAddr + 8;

  // Bill-to (left) + Invoice # / Date (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...nearBlack);
  const toLabel = 'Name: ';
  doc.setFont('helvetica', 'normal');
  const toText = doc.splitTextToSize(toLabel + v.toName, (pageW - 2 * mg) * 0.62);
  doc.text(toText, mg, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkGreen);
  doc.text('Invoice ' + v.invNo, pageW - mg, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Date  ' + formatDate(v.date), pageW - mg, y + 5, { align: 'right' });

  y += Math.max(toText.length * 4, 10) + 2;

  // ── Items table ──
  const bodyRows = items.map(function(it) {
    return [
      { content: it.desc,                                 styles: { halign: 'left'   } },
      { content: it.qty + ' ' + it.unit,                 styles: { halign: 'center' } },
      { content: fmtAmt(it.price) + ' / ' + it.unit,     styles: { halign: 'center' } },
      { content: fmtAmt(it.amt),                         styles: { halign: 'right'  } },
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Description',       styles: { halign: 'left'   } },
      { content: 'Qty',               styles: { halign: 'center' } },
      { content: 'Unit price / unit', styles: { halign: 'center' } },
      { content: 'Amount',            styles: { halign: 'right'  } },
    ]],
    body: bodyRows,
    foot: [
      [
        {
          content: 'Total:',
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 9.5,
                    fillColor: lightGreen, textColor: darkGreen,
                    lineColor: [200, 230, 201], lineWidth: 0.3 },
        },
        {
          content: fmtAmt(total),
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 11,
                    fillColor: lightGreen, textColor: darkGreen,
                    lineColor: [200, 230, 201], lineWidth: 0.3 },
        },
      ],
      [
        {
          content: 'In words: ' + indianWords(total),
          colSpan: 4,
          styles: { halign: 'left', fontSize: 8, fontStyle: 'italic',
                    fillColor: [249, 251, 231], textColor: [80, 80, 80],
                    lineColor: [200, 230, 201], lineWidth: 0.3 },
        },
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: green,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0,
      minCellHeight: 8,
    },
    bodyStyles: {
      fillColor: white,
      textColor: [30, 30, 30],
      fontSize: 9,
      lineColor: [200, 230, 201],
      lineWidth: 0.25,
      minCellHeight: 7,
    },
    alternateRowStyles: { fillColor: [241, 248, 233] },
    footStyles: {
      fillColor: white,
      fontSize: 9,
      lineWidth: 0.25,
      minCellHeight: 7,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 27 },
      2: { cellWidth: 38 },
      3: { cellWidth: 27 },
    },
    margin: { left: mg, right: mg },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── Footer ──
  const footY = Math.max(y, pageH - 22);

  doc.setDrawColor(200, 230, 201);
  doc.setLineWidth(0.3);
  doc.line(mg, footY, pageW - mg, footY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...green);
  doc.text('For ' + v.storeName, pageW - mg, footY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text('Authorised Signatory', pageW - mg, footY + 13, { align: 'right' });

  const safe = (v.invNo || 'invoice').replace(/[^\w\-]+/g, '_');
  doc.save('sachin-vegitable-store-' + safe + '.pdf');
}

// Form submit
form.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!form.reportValidity()) return;
  await generatePDF();
});

// Init
if (!loadDraft()) {
  if (dateInput) dateInput.value = todayISO();
  document.getElementById('sv-to-name').value = DEFAULT_TO_NAME;
  loadDefaultItems();
}
