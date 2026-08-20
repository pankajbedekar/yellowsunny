const API_BASE = window.location.pathname.startsWith("/retirement-planner")
  ? "/retirement-planner/api"
  : "/api";

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyInputFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

let lastWorksheet = [];

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : null;
}

function formatCurrencyValue(value) {
  const number = numberOrNull(value);
  return number === null ? "" : currencyInputFormatter.format(number);
}

function createCurrencyInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "money-input";
  input.autocomplete = "off";
  input.value = formatCurrencyValue(value);

  input.addEventListener("focus", () => {
    const number = numberOrNull(input.value);
    input.value = number === null ? "" : String(number);
    input.select();
  });

  input.addEventListener("blur", () => {
    input.value = formatCurrencyValue(input.value);
  });

  return input;
}

function createInput(type, value = "", attributes = {}) {
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  Object.entries(attributes).forEach(([key, val]) => input.setAttribute(key, val));
  return input;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    option.selected = value === item;
    select.appendChild(option);
  });
  return select;
}

function clearRowInputs(row) {
  row.querySelectorAll("input").forEach((input) => { input.value = ""; });
  row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
}

function createRowActions(row, onAdd) {
  const actions = document.createElement("div");
  actions.className = "row-actions";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn icon delete";
  deleteButton.textContent = "−";
  deleteButton.title = "Delete row";
  deleteButton.setAttribute("aria-label", "Delete row");
  deleteButton.addEventListener("click", () => {
    const tableBody = row.parentElement;
    if (tableBody && tableBody.rows.length === 1) clearRowInputs(row);
    else row.remove();
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "btn icon add";
  addButton.textContent = "+";
  addButton.title = "Add row below";
  addButton.setAttribute("aria-label", "Add row below");
  addButton.addEventListener("click", onAdd);

  actions.append(deleteButton, addButton);
  return actions;
}

function appendCell(row, element) {
  const cell = document.createElement("td");
  cell.appendChild(element);
  row.appendChild(cell);
}

function insertRow(tableId, row, insertAfter) {
  const tableBody = document.getElementById(tableId);
  if (insertAfter?.parentElement === tableBody) insertAfter.after(row);
  else tableBody.appendChild(row);
}

function addCashFlowRow(tableId, data = {}, insertAfter = null) {
  const row = document.createElement("tr");
  appendCell(row, createInput("text", data.name ?? ""));
  appendCell(row, createCurrencyInput(data.annual ?? ""));
  appendCell(row, createInput("number", data.startYear ?? "", { min: "1900", max: "2200", step: "1" }));
  appendCell(row, createInput("number", data.endYear ?? "", { min: "1900", max: "2200", step: "1" }));
  appendCell(row, createRowActions(row, () => addCashFlowRow(tableId, {}, row)));
  insertRow(tableId, row, insertAfter);
}

function addDistributionRow(data = {}, insertAfter = null) {
  const row = document.createElement("tr");
  appendCell(row, createInput("text", data.name ?? ""));
  appendCell(row, createSelect(["Normal", "Early 72t", "Early 55+", "RMD"], data.distributionType ?? "Normal"));
  appendCell(row, createCurrencyInput(data.annual ?? ""));
  appendCell(row, createInput("number", data.startYear ?? "", { min: "1900", max: "2200", step: "1" }));
  appendCell(row, createInput("number", data.endYear ?? "", { min: "1900", max: "2200", step: "1" }));
  appendCell(row, createRowActions(row, () => addDistributionRow({}, row)));
  insertRow("tblDistributions", row, insertAfter);
}

function addAssetRow(data = {}, insertAfter = null) {
  const row = document.createElement("tr");
  appendCell(row, createInput("text", data.name ?? ""));
  const assetType = ["Savings", "Brokerage"].includes(data.type) ? "Savings/Brokerage" : (data.type ?? "401K");
  appendCell(row, createSelect(["401K", "Savings/Brokerage", "IRA", "Other"], assetType));
  appendCell(row, createCurrencyInput(data.amount ?? ""));
  appendCell(row, createRowActions(row, () => addAssetRow({}, row)));
  insertRow("tblAssets", row, insertAfter);
}

function collectCashFlowRows(tableId) {
  return [...document.querySelectorAll(`#${tableId} tr`)].map((row) => {
    const controls = row.querySelectorAll("input, select");
    return {
      name: controls[0].value.trim(),
      annual: numberOrNull(controls[1].value) ?? 0,
      startYear: numberOrNull(controls[2].value),
      endYear: numberOrNull(controls[3].value),
    };
  });
}

function collectDistributionRows() {
  return [...document.querySelectorAll("#tblDistributions tr")].map((row) => {
    const controls = row.querySelectorAll("input, select");
    return {
      name: controls[0].value.trim(),
      distributionType: controls[1].value,
      annual: numberOrNull(controls[2].value) ?? 0,
      startYear: numberOrNull(controls[3].value),
      endYear: numberOrNull(controls[4].value),
    };
  });
}

function collectAssets() {
  return [...document.querySelectorAll("#tblAssets tr")].map((row) => {
    const controls = row.querySelectorAll("input, select");
    return {
      name: controls[0].value.trim(),
      type: controls[1].value,
      amount: numberOrNull(controls[2].value) ?? 0,
    };
  });
}

function selectedFilingStatus() {
  return document.querySelector('input[name="filingStatus"]:checked')?.value ?? "Single";
}

function setFilingStatus(value) {
  const radio = [...document.querySelectorAll('input[name="filingStatus"]')]
    .find((item) => item.value === value);
  (radio ?? document.querySelector('input[name="filingStatus"][value="Single"]')).checked = true;
}

function getPlan() {
  return {
    assumptions: {
      scenarioName: document.getElementById("scenarioName").value.trim() || "Default",
      retirementAge: Number(document.getElementById("retAge").value),
      retirementYear: Number(document.getElementById("retYear").value),
      filingStatus: selectedFilingStatus(),
      assetGrowthPercent: Number(document.getElementById("growthPct").value),
      inflationPercent: Number(document.getElementById("inflationPct").value),
    },
    income: collectCashFlowRows("tblIncome"),
    expenses: collectCashFlowRows("tblExpenses"),
    distributions: collectDistributionRows(),
    assets: collectAssets(),
  };
}

function worksheetObjectToArray(row) {
  return [row.year, row.age, row.income, row.expenses, row.distributions, row.taxes, row.netCashFlow, row.savings, row.portfolioAssets];
}

function worksheetArrayToObject(row) {
  return {
    year: Number(row[0]), age: Number(row[1]), income: Number(row[2]), expenses: Number(row[3]),
    distributions: Number(row[4]), taxes: Number(row[5]), netCashFlow: Number(row[6]),
    savings: Number(row[7]), portfolioAssets: Number(row[8]),
  };
}

function renderWorksheet(rows) {
  const body = document.getElementById("sheetBody");
  body.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.className = "empty-row";
    td.textContent = "Click Apply & Calculate to generate the worksheet.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    worksheetObjectToArray(row).forEach((value, index) => {
      const td = document.createElement("td");
      const numeric = Number(value) || 0;
      td.textContent = index < 2 ? String(value) : currencyFormatter.format(numeric);
      if (index === 6 && numeric < 0) td.classList.add("negative");
      if ((index === 7 || index === 8) && numeric < 0) td.classList.add("negative-strong");
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function setStatus(message, isError = false) {
  const status = document.getElementById("applyStatus");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function apiPost(path, plan) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch (_) {}
    throw new Error(detail);
  }
  return response;
}

async function calculate() {
  setStatus("Calculating…");
  try {
    const plan = getPlan();
    const response = await apiPost("/calculate", plan);
    const result = await response.json();
    lastWorksheet = result.worksheet;
    renderWorksheet(lastWorksheet);
    setStatus(`Applied ${plan.assumptions.scenarioName}. Start: age ${plan.assumptions.retirementAge}, year ${plan.assumptions.retirementYear}.`);
    return true;
  } catch (error) {
    console.error(error);
    setStatus(`Calculation error: ${error.message}`, true);
    return false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilenamePart(value) {
  const cleaned = (value || "Default")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return cleaned || "Default";
}

async function exportJson() {
  if (!lastWorksheet.length) {
    const ok = await calculate();
    if (!ok) return;
  }
  const plan = getPlan();
  const exportData = { ...plan, worksheet: lastWorksheet.map(worksheetObjectToArray) };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  downloadBlob(blob, `retirement-plan-${safeFilenamePart(plan.assumptions.scenarioName)}.json`);
}

function clearTable(tableId) { document.getElementById(tableId).innerHTML = ""; }

function loadPlanObject(obj) {
  const assumptions = obj.assumptions ?? {};
  document.getElementById("scenarioName").value = assumptions.scenarioName ?? obj.scenarioName ?? "Default";
  document.getElementById("retAge").value = assumptions.retirementAge ?? 65;
  document.getElementById("retYear").value = assumptions.retirementYear ?? 2035;
  setFilingStatus(assumptions.filingStatus ?? "Single");
  document.getElementById("growthPct").value = assumptions.assetGrowthPercent ?? 5;
  document.getElementById("inflationPct").value = assumptions.inflationPercent ?? 3.5;

  ["tblIncome", "tblExpenses", "tblDistributions", "tblAssets"].forEach(clearTable);
  const incomeRows = obj.income ?? [];
  const expenseRows = obj.expenses ?? [];
  const distributionRows = obj.distributions ?? [];
  const assetRows = obj.assets ?? [];

  incomeRows.forEach((row) => addCashFlowRow("tblIncome", row));
  expenseRows.forEach((row) => addCashFlowRow("tblExpenses", row));
  distributionRows.forEach((row) => addDistributionRow({ ...row, distributionType: row.distributionType ?? "Normal" }));
  assetRows.forEach((row) => addAssetRow(row));

  if (!incomeRows.length) addCashFlowRow("tblIncome");
  if (!expenseRows.length) addCashFlowRow("tblExpenses");
  if (!distributionRows.length) addDistributionRow();
  if (!assetRows.length) addAssetRow();

  if (Array.isArray(obj.worksheet) && obj.worksheet.length) {
    lastWorksheet = obj.worksheet.map((row) => Array.isArray(row) ? worksheetArrayToObject(row) : row);
    renderWorksheet(lastWorksheet);
    setStatus("Imported scenario, including worksheet.");
  } else {
    lastWorksheet = [];
    renderWorksheet(lastWorksheet);
    setStatus("Imported scenario. Click Apply & Calculate to recompute.");
  }
}

function seedDefaults() {
  addCashFlowRow("tblIncome", { name: "Social Security", annual: 18000, startYear: 2035, endYear: 2080 });
  addCashFlowRow("tblExpenses", { name: "Housing", annual: 24000, startYear: 2035, endYear: 2080 });
  addDistributionRow({ name: "RMD", distributionType: "RMD", annual: 12000, startYear: 2037, endYear: 2080 });
  addAssetRow({ name: "401K Balance", type: "401K", amount: 450000 });
  addAssetRow({ name: "Emergency Fund", type: "Savings/Brokerage", amount: 60000 });
}

function wireEvents() {
  document.getElementById("btnRun").addEventListener("click", calculate);
  document.getElementById("btnExportJSON").addEventListener("click", exportJson);
  const uploadInput = document.getElementById("jsonUpload");
  document.getElementById("btnImportJSON").addEventListener("click", () => uploadInput.click());
  uploadInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { loadPlanObject(JSON.parse(await file.text())); }
    catch (error) { console.error(error); setStatus("Invalid JSON file.", true); }
    finally { event.target.value = ""; }
  });
}

seedDefaults();
wireEvents();
renderWorksheet([]);
