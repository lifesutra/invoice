import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./styles.css";

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

const STORAGE_KEY = "invoice-builder-draft";
let hydrating = false;
let persistTimer = null;

const currency = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SMALL = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function wordsUnder100(n) {
  if (n < 20) return SMALL[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? "-" + SMALL[o] : "");
}

function wordsUnder1000(n) {
  if (n === 0) return "";
  if (n < 100) return wordsUnder100(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return SMALL[h] + " hundred" + (rest ? " " + wordsUnder100(rest) : "");
}

function integerToWords(n) {
  if (n < 0) {
    return "negative " + integerToWords(-n);
  }
  if (n < 1000) {
    return wordsUnder1000(n) || "zero";
  }
  if (n < 1000000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    return wordsUnder1000(th) + " thousand" + (r ? " " + wordsUnder1000(r) : "");
  }
  if (n < 1000000000) {
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    return integerToWords(m) + " million" + (r ? " " + integerToWords(r) : "");
  }
  const b = Math.floor(n / 1000000000);
  const r = n % 1000000000;
  return integerToWords(b) + " billion" + (r ? " " + integerToWords(r) : "");
}

function totalAmountInWords(amount) {
  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(rounded + 1e-8);
  const cents = Math.round((rounded - intPart) * 100 + 1e-8);
  let w = integerToWords(intPart);
  w = w.charAt(0).toUpperCase() + w.slice(1);
  if (cents === 0) {
    return w + " only";
  }
  const frac = String(cents).padStart(2, "0");
  return w + " and " + frac + "/100 only";
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseNum(el, fallback) {
  const v = parseFloat(String(el.value).replace(",", "."));
  return Number.isFinite(v) ? v : fallback;
}

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
  getRows().forEach(function (row) {
    total += recalcRow(row);
  });
  total = Math.round(total * 100) / 100;
  totalEl.textContent = currency.format(total);
  if (totalWordsEl) {
    totalWordsEl.textContent = "In words: " + totalAmountInWords(total);
  }
  return { total };
}

function bindRow(row) {
  row.querySelectorAll(".item-qty, .item-price").forEach(function (inp) {
    inp.addEventListener("input", recalcTotals);
  });
  const unitSel = row.querySelector(".item-unit");
  if (unitSel) {
    unitSel.addEventListener("change", recalcTotals);
  }
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
  if (!hydrating) {
    schedulePersist();
  }
}

function serializeDraft() {
  const rows = getRows();
  const items = rows.map(function (row) {
    return {
      desc: row.querySelector(".item-desc").value,
      qty: row.querySelector(".item-qty").value,
      unit: row.querySelector(".item-unit").value,
      price: row.querySelector(".item-price").value,
    };
  });
  return {
    v: 1,
    shopName: document.getElementById("shopName").value,
    shopAddress: document.getElementById("shopAddress").value,
    invoiceNumber: document.getElementById("invoiceNumber").value,
    invoiceDate: document.getElementById("invoiceDate").value,
    customerName: document.getElementById("customerName").value,
    items,
  };
}

function persistDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft()));
  } catch (err) {}
}

function schedulePersist() {
  if (hydrating) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(function () {
    persistTimer = null;
    persistDraft();
  }, 200);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return false;
    hydrating = true;
    const shopNameEl = document.getElementById("shopName");
    const shopAddressEl = document.getElementById("shopAddress");
    const invoiceNumberEl = document.getElementById("invoiceNumber");
    const customerNameEl = document.getElementById("customerName");
    if (shopNameEl) shopNameEl.value = typeof data.shopName === "string" ? data.shopName : "";
    if (shopAddressEl) shopAddressEl.value = typeof data.shopAddress === "string" ? data.shopAddress : "";
    if (invoiceNumberEl) invoiceNumberEl.value = typeof data.invoiceNumber === "string" ? data.invoiceNumber : "";
    if (dateInput) {
      dateInput.value =
        typeof data.invoiceDate === "string" && data.invoiceDate ? data.invoiceDate : todayISO();
    }
    if (customerNameEl) customerNameEl.value = typeof data.customerName === "string" ? data.customerName : "";
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
      if (sel && !Array.from(sel.options).some(function (o) { return o.value === sel.value; })) {
        sel.value = "NOS";
      }
    });
    recalcTotals();
    return true;
  } catch (e) {
    return false;
  } finally {
    hydrating = false;
  }
}

function resetDraft() {
  localStorage.removeItem(STORAGE_KEY);
  itemsContainer.replaceChildren();
  form.reset();
  if (dateInput) dateInput.value = todayISO();
  addItemRow({ desc: "", qty: 1, unit: "NOS", price: 0 });
  recalcTotals();
}

addItemBtn.addEventListener("click", function () {
  addItemRow();
});

if (resetDraftBtn) {
  resetDraftBtn.addEventListener("click", function () {
    if (!confirm("Clear all fields and saved draft?")) return;
    resetDraft();
  });
}

form.addEventListener("input", schedulePersist);
form.addEventListener("change", schedulePersist);

function getFormData() {
  const shopName = document.getElementById("shopName").value.trim();
  const shopAddress = document.getElementById("shopAddress").value.trim();
  const invoiceNumber = document.getElementById("invoiceNumber").value.trim();
  const invoiceDate = document.getElementById("invoiceDate").value;
  const customerName = document.getElementById("customerName").value.trim();
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
    shopName,
    shopAddress,
    invoiceNumber,
    invoiceDate,
    customerName,
    items,
    total: t.total,
  };
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function unitCodeShort(unit) {
  const u = (unit || "").trim().toUpperCase();
  if (u === "BCH") return "Bunch";
  return u;
}

function formatQtyWithUnitShort(qty, unit) {
  const q = Number(qty);
  const code = unitCodeShort(unit);
  if (!Number.isFinite(q)) {
    return "0 " + code;
  }
  const s = q % 1 === 0 ? String(Math.round(q)) : String(q);
  return s + " " + code;
}

function formatUnitPriceWithCode(price, unit) {
  const p = Number(price);
  const code = unitCodeShort(unit);
  const amt = Number.isFinite(p) ? currency.format(p) : currency.format(0);
  return code ? amt + " / " + code : amt;
}

function buildPreviewHtml(d) {
  const rows = d.items
    .map(function (it) {
      return (
        "<tr><td>" +
        escapeHtml(it.desc || "—") +
        "</td><td>" +
        escapeHtml(formatQtyWithUnitShort(it.qty, it.unit)) +
        "</td><td>" +
        escapeHtml(formatUnitPriceWithCode(it.price, it.unit)) +
        "</td><td>" +
        currency.format(it.line) +
        "</td></tr>"
      );
    })
    .join("");
  return (
    "<div class=\"preview-doc-header\">" +
    "<div class=\"preview-doc-cap\">INVOICE</div>" +
    "<div class=\"preview-shop-name\">" +
    escapeHtml(d.shopName) +
    "</div>" +
    "<div class=\"preview-meta preview-meta-center\">" +
    escapeHtml(d.shopAddress).replace(/\n/g, "<br>") +
    "</div></div>" +
    "<div class=\"preview-invoice-header\">" +
    "<div class=\"preview-invoice-header-name\"><strong>Name:</strong> " +
    escapeHtml(d.customerName) +
    "</div>" +
    "<div class=\"preview-invoice-header-ref\">" +
    "<div><strong>Invoice</strong> " +
    escapeHtml(d.invoiceNumber) +
    "</div>" +
    "<div><strong>Date</strong> " +
    escapeHtml(formatDisplayDate(d.invoiceDate)) +
    "</div>" +
    "</div></div>" +
    "<table><thead><tr><th>Item</th><th>Qty</th><th>Unit price / unit</th><th>Amount</th></tr></thead><tbody>" +
    rows +
    "</tbody></table>" +
    "<div class=\"preview-totals\">" +
    "<div><strong>Total: " +
    currency.format(d.total) +
    "</strong></div>" +
    "<div class=\"preview-total-words\">In words: " +
    escapeHtml(totalAmountInWords(d.total)) +
    "</div></div>" +
    "<div class=\"preview-for-seller\">For <strong>" +
    escapeHtml(d.shopName) +
    "</strong></div>"
  );
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

previewBtn.addEventListener("click", function () {
  if (!form.reportValidity()) return;
  previewContent.innerHTML = buildPreviewHtml(getFormData());
  previewDialog.showModal();
});

previewClose.addEventListener("click", function () {
  previewDialog.close();
});

previewDialog.addEventListener("click", function (e) {
  if (e.target === previewDialog) previewDialog.close();
});

form.addEventListener("submit", function (e) {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const d = getFormData();
  const invalidItem = d.items.some(function (it) {
    return !it.desc;
  });
  if (invalidItem) {
    form.reportValidity();
    return;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;
  const cx = pageW / 2;
  const cTitle = [18, 90, 75];
  const cAccent = [52, 130, 108];
  const cMuted = [75, 95, 90];
  const cTealHead = [15, 77, 92];
  const cBorder = [130, 175, 162];
  const cZebra = [237, 247, 243];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(cTitle[0], cTitle[1], cTitle[2]);
  doc.text("INVOICE", cx, y, { align: "center" });
  y += 10;

  doc.setFontSize(13);
  doc.setTextColor(cTitle[0], cTitle[1], cTitle[2]);
  doc.text(d.shopName, cx, y, { align: "center" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2]);
  const addrLines = doc.splitTextToSize(d.shopAddress, pageW - 2 * margin);
  doc.text(addrLines, cx, y, { align: "center" });
  y += addrLines.length * 5 + 5;
  doc.setDrawColor(cAccent[0], cAccent[1], cAccent[2]);
  doc.setLineWidth(0.45);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const yMeta = y;
  const gutter = 6;
  const rightColW = 52;
  const leftMaxW = pageW - 2 * margin - rightColW - gutter;
  const nameBlock = "Name: " + d.customerName;
  const nameLines = doc.splitTextToSize(nameBlock, leftMaxW);
  doc.text(nameLines, margin, yMeta);
  const rightX = pageW - margin;
  doc.text("Invoice " + d.invoiceNumber, rightX, yMeta, { align: "right" });
  doc.text("Date " + formatDisplayDate(d.invoiceDate), rightX, yMeta + 5, { align: "right" });
  const lineH = 5;
  const leftH = nameLines.length * lineH;
  const rightH = 10;
  y = yMeta + Math.max(leftH, rightH) + 8;

  const tableBody = d.items.map(function (it) {
    return [
      it.desc,
      formatQtyWithUnitShort(it.qty, it.unit),
      formatUnitPriceWithCode(it.price, it.unit),
      currency.format(it.line),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price / unit", "Amount"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: cTealHead,
      textColor: [255, 255, 255],
      halign: "center",
      valign: "middle",
      fontStyle: "bold",
      lineColor: cTealHead,
      lineWidth: 0.2,
    },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: cBorder,
      lineWidth: 0.15,
      textColor: [35, 45, 42],
    },
    alternateRowStyles: {
      fillColor: cZebra,
    },
    columnStyles: {
      0: { cellWidth: 58, halign: "left" },
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "right", cellWidth: 46 },
      3: { halign: "right", cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(cTitle[0], cTitle[1], cTitle[2]);
  doc.text("Total: " + currency.format(d.total), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2]);
  const wordsText = "In words: " + totalAmountInWords(d.total);
  const wordsLines = doc.splitTextToSize(wordsText, pageW - 2 * margin);
  doc.text(wordsLines, margin, y);
  y += wordsLines.length * 4.5 + 8;
  doc.setFontSize(10);
  doc.setTextColor(cTitle[0], cTitle[1], cTitle[2]);
  doc.text("For " + d.shopName, pageW - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(cAccent[0], cAccent[1], cAccent[2]);
  doc.setLineWidth(0.25);
  const sigLineW = 55;
  doc.line(pageW - margin - sigLineW, y + 10, pageW - margin, y + 10);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  const safeName = d.invoiceNumber.replace(/[^\w\-]+/g, "_") || "invoice";
  doc.save("invoice-" + safeName + ".pdf");
});

if (!loadDraft()) {
  if (dateInput && !dateInput.value) dateInput.value = todayISO();
  addItemRow({ desc: "", qty: 1, unit: "NOS", price: 0 });
}
