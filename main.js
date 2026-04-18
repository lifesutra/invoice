import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const form = document.getElementById("invoice-form");
const itemsContainer = document.getElementById("items-container");
const addItemBtn = document.getElementById("add-item");
const template = document.getElementById("item-row-template");
const totalEl = document.getElementById("total-display");
const totalWordsEl = document.getElementById("total-words-display");
const dateInput = document.getElementById("invoiceDate");
const previewBtn = document.getElementById("preview-btn");
const previewDialog = document.getElementById("preview-dialog");
const previewContent = document.getElementById("preview-content");
const previewClose = document.getElementById("preview-close");
const resetDraftBtn = document.getElementById("reset-draft-btn");
const templatePicker = document.getElementById("template-picker");

const STORAGE_KEY = "invoice-builder-draft";
let hydrating = false;
let persistTimer = null;
let currentTemplate = localStorage.getItem("invoice-tpl") || "classic";

// ── Theme picker ──
const htmlEl = document.documentElement;
const themePickerBtn = document.getElementById("theme-picker-btn");
const themePalette = document.getElementById("theme-palette");
const themePickerDot = document.getElementById("theme-picker-dot");

const THEME_ACCENTS = {
  dark: "#5ce1a8", light: "#1f9e68", ocean: "#38bdf8",
  slate: "#818cf8", ember: "#fb923c", rose: "#f472b6",
};

function applyTheme(t) {
  htmlEl.setAttribute("data-theme", t);
  localStorage.setItem("invoice-theme", t);
  if (themePickerDot) themePickerDot.style.background = THEME_ACCENTS[t] || THEME_ACCENTS.dark;
  themePalette.querySelectorAll(".tswatch").forEach(function (s) {
    s.classList.toggle("active", s.dataset.t === t);
  });
}

applyTheme(localStorage.getItem("invoice-theme") || "dark");

themePickerBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  themePalette.hidden = !themePalette.hidden;
});

themePalette.addEventListener("click", function (e) {
  e.stopPropagation();
  const s = e.target.closest(".tswatch");
  if (s) { applyTheme(s.dataset.t); themePalette.hidden = true; }
});

document.addEventListener("click", function () { themePalette.hidden = true; });

// ── Template picker ──
function setTemplate(tpl) {
  currentTemplate = tpl;
  localStorage.setItem("invoice-tpl", tpl);
  templatePicker.querySelectorAll(".tpl-card").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.tpl === tpl);
  });
}

setTemplate(currentTemplate);

templatePicker.addEventListener("click", function (e) {
  const card = e.target.closest(".tpl-card");
  if (card) setTemplate(card.dataset.tpl);
});

// ── Currency / words helpers ──
const currency = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SMALL = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS  = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function wordsUnder100(n) {
  if (n < 20) return SMALL[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + SMALL[n % 10] : "");
}

function wordsUnder1000(n) {
  if (n === 0) return "";
  if (n < 100) return wordsUnder100(n);
  return SMALL[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + wordsUnder100(n % 100) : "");
}

function integerToWords(n) {
  if (n < 0) return "negative " + integerToWords(-n);
  if (n < 1000) return wordsUnder1000(n) || "zero";
  if (n < 1000000) return wordsUnder1000(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + wordsUnder1000(n % 1000) : "");
  if (n < 1000000000) return integerToWords(Math.floor(n / 1000000)) + " million" + (n % 1000000 ? " " + integerToWords(n % 1000000) : "");
  return integerToWords(Math.floor(n / 1000000000)) + " billion" + (n % 1000000000 ? " " + integerToWords(n % 1000000000) : "");
}

function totalAmountInWords(amount) {
  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(rounded + 1e-8);
  const cents = Math.round((rounded - intPart) * 100 + 1e-8);
  let w = integerToWords(intPart);
  w = w.charAt(0).toUpperCase() + w.slice(1);
  if (cents === 0) return w + " only";
  return w + " and " + String(cents).padStart(2, "0") + "/100 only";
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseNum(el, fallback) {
  const v = parseFloat(String(el.value).replace(",", "."));
  return Number.isFinite(v) ? v : fallback;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const p = iso.split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
}

function unitCodeShort(unit) {
  const u = (unit || "").trim().toUpperCase();
  return u === "BCH" ? "Bunch" : u;
}

function formatQty(qty, unit) {
  const q = Number(qty);
  const code = unitCodeShort(unit);
  const s = q % 1 === 0 ? String(Math.round(q)) : String(q);
  return (Number.isFinite(q) ? s : "0") + " " + code;
}

function formatUnitPrice(price, unit) {
  const p = Number(price);
  const code = unitCodeShort(unit);
  const amt = Number.isFinite(p) ? currency.format(p) : currency.format(0);
  return code ? amt + " / " + code : amt;
}

// ── Row management ──
function recalcRow(row) {
  const qty = parseNum(row.querySelector(".item-qty"), 0);
  const price = parseNum(row.querySelector(".item-price"), 0);
  const line = Math.round(qty * price * 100) / 100;
  const lineInput = row.querySelector(".item-line-total");
  if (lineInput) lineInput.value = currency.format(line);
  return line;
}

function getRows() {
  return Array.from(itemsContainer.querySelectorAll("[data-item]"));
}

function recalcTotals() {
  let total = 0;
  getRows().forEach(function (row) { total += recalcRow(row); });
  total = Math.round(total * 100) / 100;
  totalEl.textContent = currency.format(total);
  if (totalWordsEl) totalWordsEl.textContent = "In words: " + totalAmountInWords(total);
  return { total };
}

function bindRow(row) {
  row.querySelectorAll(".item-qty, .item-price").forEach(function (inp) {
    inp.addEventListener("input", recalcTotals);
  });
  const unitSel = row.querySelector(".item-unit");
  if (unitSel) unitSel.addEventListener("change", recalcTotals);
  const removeBtn = row.querySelector("[data-remove]");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      if (getRows().length <= 1) return;
      row.remove();
      recalcTotals();
      schedulePersist();
    });
  }
}

function addItemRow(data) {
  const node = template.content.cloneNode(true);
  const row = node.querySelector("[data-item]");
  if (data) {
    const d = row.querySelector(".item-desc");
    const q = row.querySelector(".item-qty");
    const p = row.querySelector(".item-price");
    const u = row.querySelector(".item-unit");
    if (d && data.desc != null) d.value = data.desc;
    if (q && data.qty != null) q.value = data.qty;
    if (p && data.price != null) p.value = data.price;
    if (u && data.unit != null) u.value = data.unit;
  }
  itemsContainer.appendChild(node);
  bindRow(itemsContainer.lastElementChild);
  recalcTotals();
  if (!hydrating) schedulePersist();
}

// ── Draft persistence ──
function serializeDraft() {
  const rows = getRows();
  return {
    v: 1,
    shopName: document.getElementById("shopName").value,
    shopAddress: document.getElementById("shopAddress").value,
    invoiceNumber: document.getElementById("invoiceNumber").value,
    invoiceDate: document.getElementById("invoiceDate").value,
    customerName: document.getElementById("customerName").value,
    items: rows.map(function (row) {
      return {
        desc: row.querySelector(".item-desc").value,
        qty: row.querySelector(".item-qty").value,
        unit: row.querySelector(".item-unit").value,
        price: row.querySelector(".item-price").value,
      };
    }),
  };
}

function persistDraft() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft())); } catch (e) {}
}

function schedulePersist() {
  if (hydrating) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(function () { persistTimer = null; persistDraft(); }, 200);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return false;
    hydrating = true;
    const set = function (id, val) { const el = document.getElementById(id); if (el) el.value = typeof val === "string" ? val : ""; };
    set("shopName", data.shopName);
    set("shopAddress", data.shopAddress);
    set("invoiceNumber", data.invoiceNumber);
    set("customerName", data.customerName);
    if (dateInput) dateInput.value = (typeof data.invoiceDate === "string" && data.invoiceDate) ? data.invoiceDate : todayISO();
    itemsContainer.replaceChildren();
    if (data.items.length === 0) {
      addItemRow({ desc: "", qty: 1, unit: "NOS", price: 0 });
    } else {
      data.items.forEach(function (it) {
        addItemRow({
          desc: it.desc != null ? String(it.desc) : "",
          qty: it.qty != null && it.qty !== "" ? it.qty : 1,
          unit: it.unit != null ? String(it.unit) : "NOS",
          price: it.price != null && it.price !== "" ? it.price : 0,
        });
      });
    }
    getRows().forEach(function (row) {
      const sel = row.querySelector(".item-unit");
      if (sel && !Array.from(sel.options).some(function (o) { return o.value === sel.value; })) sel.value = "NOS";
    });
    recalcTotals();
    return true;
  } catch (e) { return false; }
  finally { hydrating = false; }
}

function resetDraft() {
  localStorage.removeItem(STORAGE_KEY);
  itemsContainer.replaceChildren();
  form.reset();
  if (dateInput) dateInput.value = todayISO();
  addItemRow({ desc: "", qty: 1, unit: "NOS", price: 0 });
  recalcTotals();
}

// ── Form data ──
function getFormData() {
  const rows = getRows();
  const items = rows.map(function (row) {
    return {
      desc: row.querySelector(".item-desc").value.trim(),
      qty: parseNum(row.querySelector(".item-qty"), 0),
      unit: row.querySelector(".item-unit").value,
      price: parseNum(row.querySelector(".item-price"), 0),
      line: recalcRow(row),
    };
  });
  const t = recalcTotals();
  return {
    shopName: document.getElementById("shopName").value.trim(),
    shopAddress: document.getElementById("shopAddress").value.trim(),
    invoiceNumber: document.getElementById("invoiceNumber").value.trim(),
    invoiceDate: document.getElementById("invoiceDate").value,
    customerName: document.getElementById("customerName").value.trim(),
    items,
    total: t.total,
  };
}

// ── Preview HTML builders ──
function tableRowsHtml(items) {
  return items.map(function (it) {
    return "<tr><td>" + escapeHtml(it.desc || "—") +
      "</td><td>" + escapeHtml(formatQty(it.qty, it.unit)) +
      "</td><td>" + escapeHtml(formatUnitPrice(it.price, it.unit)) +
      "</td><td>" + currency.format(it.line) + "</td></tr>";
  }).join("");
}

function sharedFooterHtml(d) {
  return '<div class="pv-totals">' +
    '<div class="pv-totals-amt">Total: ' + currency.format(d.total) + '</div>' +
    '</div>' +
    '<div class="pv-total-words">In words: ' + escapeHtml(totalAmountInWords(d.total)) + '</div>' +
    '<div class="pv-for-seller">For <strong>' + escapeHtml(d.shopName) + '</strong></div>';
}

function metaHtml(d) {
  return '<div class="pv-meta">' +
    '<div class="pv-meta-name"><strong>Bill to:</strong> ' + escapeHtml(d.customerName) + '</div>' +
    '<div class="pv-meta-ref">' +
    '<div><strong>Invoice</strong> ' + escapeHtml(d.invoiceNumber) + '</div>' +
    '<div><strong>Date</strong> ' + escapeHtml(formatDisplayDate(d.invoiceDate)) + '</div>' +
    '</div></div>';
}

function tableHtml(items) {
  return '<table class="pv-table"><thead><tr>' +
    '<th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th>' +
    '</tr></thead><tbody>' + tableRowsHtml(items) + '</tbody></table>';
}

function buildPreviewClassic(d) {
  return '<div class="pv-header">' +
    '<div class="pv-cap">INVOICE</div>' +
    '<div class="pv-shop">' + escapeHtml(d.shopName) + '</div>' +
    '<div class="pv-addr">' + escapeHtml(d.shopAddress).replace(/\n/g, "<br>") + '</div>' +
    '</div>' +
    metaHtml(d) +
    tableHtml(d.items) +
    sharedFooterHtml(d);
}

function buildPreviewModern(d) {
  return '<div class="pv-header">' +
    '<div class="pv-header-left">' +
    '<div class="pv-cap">INVOICE</div>' +
    '<div class="pv-shop">' + escapeHtml(d.shopName) + '</div>' +
    '</div>' +
    '<div class="pv-header-right">' +
    '<div><strong>#' + escapeHtml(d.invoiceNumber) + '</strong></div>' +
    '<div>' + escapeHtml(formatDisplayDate(d.invoiceDate)) + '</div>' +
    '</div></div>' +
    '<div class="pv-body">' +
    '<div class="pv-addr">' + escapeHtml(d.shopAddress).replace(/\n/g, "<br>") + '</div>' +
    '<div class="pv-meta-name" style="font-size:0.82rem;margin-bottom:0.75rem"><strong>Bill to:</strong> ' + escapeHtml(d.customerName) + '</div>' +
    tableHtml(d.items) +
    sharedFooterHtml(d) +
    '</div>';
}

function buildPreviewMinimal(d) {
  return '<div class="pv-header">' +
    '<div class="pv-cap">INVOICE</div>' +
    '<div class="pv-shop">' + escapeHtml(d.shopName) + '</div>' +
    '<div class="pv-addr">' + escapeHtml(d.shopAddress).replace(/\n/g, "<br>") + '</div>' +
    '<div class="pv-divider"></div>' +
    '</div>' +
    metaHtml(d) +
    tableHtml(d.items) +
    sharedFooterHtml(d);
}

function buildPreviewEvent(d) {
  return '<div class="pv-header">' +
    '<div class="pv-header-left">' +
    '<div class="pv-shop">' + escapeHtml(d.shopName) + '</div>' +
    '<div class="pv-addr">' + escapeHtml(d.shopAddress).replace(/\n/g, "<br>") + '</div>' +
    '</div>' +
    '<div class="pv-header-right">' +
    '<div><strong>Invoice #</strong> ' + escapeHtml(d.invoiceNumber) + '</div>' +
    '<div><strong>Date</strong> ' + escapeHtml(formatDisplayDate(d.invoiceDate)) + '</div>' +
    '</div></div>' +
    '<div class="pv-body">' +
    '<div style="font-size:0.82rem;margin-bottom:0.75rem"><strong>Bill to:</strong> ' + escapeHtml(d.customerName) + '</div>' +
    tableHtml(d.items) +
    sharedFooterHtml(d) +
    '</div>';
}

function buildPreviewTech(d) {
  return '<div class="pv-header">' +
    '<div class="pv-header-left">' +
    '<div class="pv-shop">' + escapeHtml(d.shopName) + '</div>' +
    '</div>' +
    '<div class="pv-header-right">' +
    '<div><strong>Invoice #</strong> ' + escapeHtml(d.invoiceNumber) + '</div>' +
    '<div><strong>Date</strong> ' + escapeHtml(formatDisplayDate(d.invoiceDate)) + '</div>' +
    '</div></div>' +
    '<div class="pv-body">' +
    '<div class="pv-addr">' + escapeHtml(d.shopAddress).replace(/\n/g, "<br>") + '</div>' +
    '<div style="font-size:0.82rem;margin-bottom:0.75rem"><strong>Bill to:</strong> ' + escapeHtml(d.customerName) + '</div>' +
    tableHtml(d.items) +
    sharedFooterHtml(d) +
    '</div>';
}

function buildPreviewTravel(d) {
  return '<div class="pv-header">' +
    '<div class="pv-header-left">' +
    '<div class="pv-shop">' + escapeHtml(d.shopName) + '</div>' +
    '</div>' +
    '<div class="pv-header-right">' +
    '<div><strong>Invoice #</strong> ' + escapeHtml(d.invoiceNumber) + '</div>' +
    '<div><strong>Date</strong> ' + escapeHtml(formatDisplayDate(d.invoiceDate)) + '</div>' +
    '</div></div>' +
    '<div class="pv-body">' +
    '<div class="pv-addr">' + escapeHtml(d.shopAddress).replace(/\n/g, "<br>") + '</div>' +
    '<div style="font-size:0.82rem;margin-bottom:0.75rem"><strong>Bill to:</strong> ' + escapeHtml(d.customerName) + '</div>' +
    tableHtml(d.items) +
    sharedFooterHtml(d) +
    '</div>';
}

function buildPreviewHtml(d) {
  previewContent.className = "preview-sheet tpl-" + currentTemplate;
  if (currentTemplate === "modern")  return buildPreviewModern(d);
  if (currentTemplate === "minimal") return buildPreviewMinimal(d);
  if (currentTemplate === "event")   return buildPreviewEvent(d);
  if (currentTemplate === "tech")    return buildPreviewTech(d);
  if (currentTemplate === "travel")  return buildPreviewTravel(d);
  return buildPreviewClassic(d);
}

// ── PDF builders ──
function pdfClassic(doc, d) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;
  const cx = pageW / 2;

  const cTitle  = [26, 58, 47];
  const cAccent = [52, 130, 108];
  const cMuted  = [75, 95, 90];
  const cHead   = [15, 77, 92];
  const cBorder = [130, 175, 162];
  const cZebra  = [237, 247, 243];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...cTitle);
  doc.text("INVOICE", cx, y, { align: "center" });
  y += 9;

  doc.setFontSize(13);
  doc.text(d.shopName, cx, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...cMuted);
  const addrLines = doc.splitTextToSize(d.shopAddress, pageW - 2 * margin);
  doc.text(addrLines, cx, y, { align: "center" });
  y += addrLines.length * 5 + 5;

  doc.setDrawColor(...cAccent);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const nameLines = doc.splitTextToSize("Bill to: " + d.customerName, pageW - 2 * margin - 56);
  doc.text(nameLines, margin, y);
  doc.text("Invoice " + d.invoiceNumber, pageW - margin, y, { align: "right" });
  doc.text("Date " + formatDisplayDate(d.invoiceDate), pageW - margin, y + 5, { align: "right" });
  y += Math.max(nameLines.length * 5, 10) + 8;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: d.items.map(function (it) {
      return [it.desc, formatQty(it.qty, it.unit), formatUnitPrice(it.price, it.unit), currency.format(it.line)];
    }),
    theme: "grid",
    headStyles: { fillColor: cHead, textColor: [255,255,255], halign: "center", fontStyle: "bold", lineColor: cHead, lineWidth: 0.2 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: cBorder, lineWidth: 0.15, textColor: [35,45,42] },
    alternateRowStyles: { fillColor: cZebra },
    columnStyles: {
      0: { cellWidth: 60, halign: "left" },
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "right", cellWidth: 46 },
      3: { halign: "right", cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTitle);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...cMuted);
  const wordsLines = doc.splitTextToSize("In words: " + totalAmountInWords(d.total), pageW - 2 * margin);
  doc.text(wordsLines, margin, y);
  y += wordsLines.length * 4.5 + 8;
  doc.setFontSize(10);
  doc.setTextColor(...cTitle);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...cAccent);
  doc.setLineWidth(0.25);
  doc.line(pageW - margin - 55, y + 10, pageW - margin, y + 10);
}

function pdfModern(doc, d) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 0;

  const cBlue   = [30, 58, 138];
  const cBlueLt = [191, 219, 254];
  const cDark   = [17, 24, 39];
  const cGray   = [107, 114, 128];
  const cBorder = [209, 213, 219];
  const cZebra  = [243, 244, 246];
  const headerH = 40;

  doc.setFillColor(...cBlue);
  doc.rect(0, 0, pageW, headerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", margin, 17);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cBlueLt);
  doc.text(d.shopName, margin, 26);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("#" + d.invoiceNumber, pageW - margin, 16, { align: "right" });
  doc.setTextColor(...cBlueLt);
  doc.text(formatDisplayDate(d.invoiceDate), pageW - margin, 22, { align: "right" });

  y = headerH + 10;

  doc.setFontSize(9);
  doc.setTextColor(...cGray);
  const addrLines = doc.splitTextToSize(d.shopAddress, 80);
  doc.text(addrLines, margin, y);
  y += addrLines.length * 4.5 + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...cDark);
  doc.text("BILL TO", margin, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(d.customerName, margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: d.items.map(function (it) {
      return [it.desc, formatQty(it.qty, it.unit), formatUnitPrice(it.price, it.unit), currency.format(it.line)];
    }),
    theme: "grid",
    headStyles: { fillColor: cBlue, textColor: [255,255,255], halign: "center", fontStyle: "bold", lineColor: cBlue, lineWidth: 0.2 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: cBorder, lineWidth: 0.15, textColor: cDark },
    alternateRowStyles: { fillColor: cZebra },
    columnStyles: {
      0: { cellWidth: 60, halign: "left" },
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "right", cellWidth: 46 },
      3: { halign: "right", cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cBlue);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...cGray);
  const wordsLines = doc.splitTextToSize("In words: " + totalAmountInWords(d.total), pageW - 2 * margin);
  doc.text(wordsLines, margin, y);
  y += wordsLines.length * 4.5 + 8;
  doc.setFontSize(10);
  doc.setTextColor(...cDark);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...cBlue);
  doc.setLineWidth(0.3);
  doc.line(pageW - margin - 55, y + 10, pageW - margin, y + 10);
}

function pdfMinimal(doc, d) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const cBlack  = [17, 17, 17];
  const cGray   = [85, 85, 85];
  const cBorder = [200, 200, 200];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...cBlack);
  doc.text("INVOICE", margin, y);
  y += 7;

  doc.setFontSize(13);
  doc.text(d.shopName, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...cGray);
  const addrLines = doc.splitTextToSize(d.shopAddress, 90);
  doc.text(addrLines, margin, y);
  y += addrLines.length * 4.5 + 4;

  doc.setDrawColor(...cBlack);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setTextColor(...cBlack);
  doc.setFontSize(9);
  const nameLines = doc.splitTextToSize("Bill to: " + d.customerName, pageW - 2 * margin - 56);
  doc.text(nameLines, margin, y);
  doc.text("Invoice " + d.invoiceNumber, pageW - margin, y, { align: "right" });
  doc.text("Date " + formatDisplayDate(d.invoiceDate), pageW - margin, y + 5, { align: "right" });
  y += Math.max(nameLines.length * 5, 10) + 8;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: d.items.map(function (it) {
      return [it.desc, formatQty(it.qty, it.unit), formatUnitPrice(it.price, it.unit), currency.format(it.line)];
    }),
    theme: "plain",
    headStyles: { textColor: cBlack, fontStyle: "bold", fontSize: 8, lineColor: cBlack, lineWidth: { bottom: 0.5 }, fillColor: false },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: cBorder, lineWidth: { bottom: 0.15 }, textColor: cBlack },
    columnStyles: {
      0: { cellWidth: 60, halign: "left" },
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "right", cellWidth: 46 },
      3: { halign: "right", cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cBlack);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...cGray);
  const wordsLines = doc.splitTextToSize("In words: " + totalAmountInWords(d.total), pageW - 2 * margin);
  doc.text(wordsLines, margin, y);
  y += wordsLines.length * 4.5 + 8;
  doc.setFontSize(10);
  doc.setTextColor(...cBlack);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...cGray);
  doc.setLineWidth(0.2);
  doc.line(pageW - margin - 55, y + 10, pageW - margin, y + 10);
}

function pdfEvent(doc, d) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const headerH = 44;

  doc.setFillColor(59, 7, 100);
  doc.rect(0, 0, pageW / 2, headerH, "F");
  doc.setFillColor(219, 39, 119);
  doc.rect(pageW / 2, 0, pageW / 2, headerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(d.shopName, margin, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setGState(new doc.GState({ opacity: 0.75 }));
  const addrLines = doc.splitTextToSize(d.shopAddress, 80);
  doc.text(addrLines, margin, 30);
  doc.setGState(new doc.GState({ opacity: 1 }));

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Invoice # " + d.invoiceNumber, pageW - margin, 18, { align: "right" });
  doc.text("Date  " + formatDisplayDate(d.invoiceDate), pageW - margin, 26, { align: "right" });

  let y = headerH + 9;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  const nameLines = doc.splitTextToSize("Bill to: " + d.customerName, pageW - 2 * margin);
  doc.text(nameLines, margin, y);
  y += Math.max(nameLines.length * 5, 6) + 8;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: d.items.map(function (it) { return [it.desc, formatQty(it.qty, it.unit), formatUnitPrice(it.price, it.unit), currency.format(it.line)]; }),
    theme: "grid",
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", lineColor: [124, 58, 237], lineWidth: 0.2 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [233, 213, 255], lineWidth: 0.15, textColor: [30, 10, 60] },
    alternateRowStyles: { fillColor: [250, 245, 255] },
    columnStyles: { 0: { cellWidth: 60, halign: "left" }, 1: { halign: "center", cellWidth: 28 }, 2: { halign: "right", cellWidth: 46 }, 3: { halign: "right", cellWidth: 30 } },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(124, 58, 237);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 80, 130);
  const wl = doc.splitTextToSize("In words: " + totalAmountInWords(d.total), pageW - 2 * margin);
  doc.text(wl, margin, y);
  y += wl.length * 4.5 + 8;
  doc.setFontSize(10); doc.setTextColor(59, 7, 100);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  doc.setDrawColor(124, 58, 237); doc.setLineWidth(0.25);
  doc.line(pageW - margin - 55, y + 10, pageW - margin, y + 10);
}

function pdfTech(doc, d) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const cDark = [15, 23, 42];
  const cCyan = [34, 211, 238];
  const cGray = [100, 116, 139];

  doc.setFillColor(...cDark);
  doc.rect(0, 0, pageW, 40, "F");

  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(d.shopName, margin, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...cCyan);
  doc.text("Invoice #  " + d.invoiceNumber, pageW - margin, 16, { align: "right" });
  doc.setTextColor(...cGray);
  doc.text("Date  " + formatDisplayDate(d.invoiceDate), pageW - margin, 23, { align: "right" });

  let y = 50;
  doc.setTextColor(...cGray); doc.setFontSize(9);
  const addrLines = doc.splitTextToSize(d.shopAddress, 80);
  doc.text(addrLines, margin, y); y += addrLines.length * 4.5 + 6;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...cDark);
  doc.text("BILL TO", margin, y); y += 4.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(d.customerName, margin, y); y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: d.items.map(function (it) { return [it.desc, formatQty(it.qty, it.unit), formatUnitPrice(it.price, it.unit), currency.format(it.line)]; }),
    theme: "grid",
    headStyles: { fillColor: cDark, textColor: cCyan, halign: "center", fontStyle: "bold", lineColor: cDark, lineWidth: 0.2 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: cDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 60, halign: "left" }, 1: { halign: "center", cellWidth: 28 }, 2: { halign: "right", cellWidth: 46 }, 3: { halign: "right", cellWidth: 30 } },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...cDark);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...cGray);
  const wl = doc.splitTextToSize("In words: " + totalAmountInWords(d.total), pageW - 2 * margin);
  doc.text(wl, margin, y);
  y += wl.length * 4.5 + 8;
  doc.setFontSize(10); doc.setTextColor(...cDark);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  doc.setDrawColor(...cCyan); doc.setLineWidth(0.3);
  doc.line(pageW - margin - 55, y + 10, pageW - margin, y + 10);
}

function pdfTravel(doc, d) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const cAmber = [146, 64, 14];
  const cGold  = [180, 83, 9];
  const cMuted = [120, 113, 108];

  doc.setFillColor(...cAmber);
  doc.rect(0, 0, pageW / 2, 42, "F");
  doc.setFillColor(251, 191, 36);
  doc.rect(pageW / 2, 0, pageW / 2, 42, "F");

  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
  doc.text(d.shopName, margin, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.setGState(new doc.GState({ opacity: 0.85 }));
  const addrLines = doc.splitTextToSize(d.shopAddress, 80);
  doc.text(addrLines, margin, 29);
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.text("Invoice #  " + d.invoiceNumber, pageW - margin, 17, { align: "right" });
  doc.text("Date  " + formatDisplayDate(d.invoiceDate), pageW - margin, 25, { align: "right" });

  let y = 52;
  doc.setTextColor(...cMuted); doc.setFontSize(9);
  const addrLines2 = doc.splitTextToSize(d.shopAddress, 80);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...cAmber);
  doc.text("BILL TO", margin, y); y += 4.5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
  doc.text(d.customerName, margin, y); y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: d.items.map(function (it) { return [it.desc, formatQty(it.qty, it.unit), formatUnitPrice(it.price, it.unit), currency.format(it.line)]; }),
    theme: "grid",
    headStyles: { fillColor: cAmber, textColor: [255, 255, 255], halign: "center", fontStyle: "bold", lineColor: cAmber, lineWidth: 0.2 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [254, 243, 199], lineWidth: 0.15, textColor: [28, 25, 23] },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    columnStyles: { 0: { cellWidth: 60, halign: "left" }, 1: { halign: "center", cellWidth: 28 }, 2: { halign: "right", cellWidth: 46 }, 3: { halign: "right", cellWidth: 30 } },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...cAmber);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...cMuted);
  const wl = doc.splitTextToSize("In words: " + totalAmountInWords(d.total), pageW - 2 * margin);
  doc.text(wl, margin, y);
  y += wl.length * 4.5 + 8;
  doc.setFontSize(10); doc.setTextColor(...cGold);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  doc.setDrawColor(...cAmber); doc.setLineWidth(0.25);
  doc.line(pageW - margin - 55, y + 10, pageW - margin, y + 10);
}

// ── Event bindings ──
addItemBtn.addEventListener("click", function () { addItemRow(); });

if (resetDraftBtn) {
  resetDraftBtn.addEventListener("click", function () {
    if (!confirm("Clear all fields and saved draft?")) return;
    resetDraft();
  });
}

form.addEventListener("input", schedulePersist);
form.addEventListener("change", schedulePersist);

previewBtn.addEventListener("click", function () {
  if (!form.reportValidity()) return;
  previewContent.innerHTML = buildPreviewHtml(getFormData());
  previewDialog.showModal();
});

previewClose.addEventListener("click", function () { previewDialog.close(); });

previewDialog.addEventListener("click", function (e) {
  if (e.target === previewDialog) previewDialog.close();
});

form.addEventListener("submit", function (e) {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const d = getFormData();
  if (d.items.some(function (it) { return !it.desc; })) { form.reportValidity(); return; }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  if (currentTemplate === "modern")       pdfModern(doc, d);
  else if (currentTemplate === "minimal") pdfMinimal(doc, d);
  else if (currentTemplate === "event")   pdfEvent(doc, d);
  else if (currentTemplate === "tech")    pdfTech(doc, d);
  else if (currentTemplate === "travel")  pdfTravel(doc, d);
  else pdfClassic(doc, d);

  const safeName = d.invoiceNumber.replace(/[^\w\-]+/g, "_") || "invoice";
  doc.save("invoice-" + safeName + ".pdf");
});

// ── Init ──
if (!loadDraft()) {
  if (dateInput && !dateInput.value) dateInput.value = todayISO();
  addItemRow({ desc: "", qty: 1, unit: "NOS", price: 0 });
}
