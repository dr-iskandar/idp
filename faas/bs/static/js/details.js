const api = "https://api.exchangerate-api.com/v4/latest/USD";
let exchangeRates = {};
let originalAccountData = [];
let originalTransactionData = [];

document.addEventListener("DOMContentLoaded", function () {
  setupTabNavigation();
  fetchSummary();
  fetchAccountsList();
  fetchTransactionsActivity();
  fetchPageDetails();
  setupEditModeToggle();
  fetchCategories();
  toggleEditModeCategorization();
  fetchExchangeRates();
});

function fetchExchangeRates() {
  fetch(api)
    .then((response) => response.json())
    .then((data) => {
      exchangeRates = data.rates;
      exchangeRates["default"] = 1;
    })
    .catch((error) => console.error("Error fetching exchange rates:", error));
}

document
  .getElementById("currency-select")
  .addEventListener("change", function () {
    let selectedCurrency = this.value;
    convertCurrency(selectedCurrency);
  });

document
  .getElementById("currency-accounts-select")
  .addEventListener("change", function () {
    let selectedCurrency = this.value;
    updateTransactionsActivity(lastFetchedData, selectedCurrency);
  });

function convertCurrency(targetCurrency) {
  let rows = document.querySelectorAll("#bs-table-body tr");

  rows.forEach((row, index) => {
    let accountData = originalAccountData[index];
    let fromRate = exchangeRates[accountData.currency];
    let toRate = exchangeRates[targetCurrency];

    let newDepositsValue = (
      (toRate / fromRate) *
      accountData.totalDeposits
    ).toLocaleString();
    let newDebitsValue = (
      (toRate / fromRate) *
      accountData.totalDebits
    ).toLocaleString();

    if (targetCurrency === "default") {
      row.children[5].innerText = accountData.currency;
      row.children[6].innerText = `${accountData.currency} ${accountData.totalDeposits}`;
      row.children[7].innerText = `${accountData.currency} ${accountData.totalDebits}`;
    } else {
      row.children[5].innerText = targetCurrency;
      row.children[6].innerText = `${targetCurrency} ${newDepositsValue}`;
      row.children[7].innerText = `${targetCurrency} ${newDebitsValue}`;
    }
  });
}

function setupTabNavigation() {
  const tabs = document.querySelectorAll("#nav-tab button");
  tabs.forEach((tab) => {
    tab.addEventListener("click", function (event) {
      const target = event.target.getAttribute("data-bs-target");
      history.pushState(null, "", `${window.location.pathname}${target}`);
    });
  });

  const hash = window.location.hash;
  if (hash) {
    const targetTab = document.querySelector(
      `#nav-tab button[data-bs-target="${hash}"]`
    );
    if (targetTab) {
      new bootstrap.Tab(targetTab).show();
    }
  }
}

function fetchSummary() {
  fetch(`/api/faas/bs/v1/summary?bsId=${statementId}`)
    .then(handleFetchResponse)
    .then(updateSummary)
    .catch(handleFetchError);
}

function fetchAccountsList() {
  fetch(`/api/faas/bs/v1/accounts/list?bsId=${statementId}`)
    .then(handleFetchResponse)
    .then(updateAccountsList)
    .catch(handleFetchError);
}

function fetchTransactionsActivity() {
  fetch(`/api/faas/bs/v1/transactions/activity?bsId=${statementId}`)
    .then(handleFetchResponse)
    .then((data) => {
      lastFetchedData = data;
      updateTransactionsActivity(data);
    })
    .catch(handleFetchError);
}

function fetchPageDetails() {
  fetch(`/api/faas/bs/v1/pages/details?bsId=${statementId}`)
    .then(handleFetchResponse)
    .then(updatePageDetails)
    .catch(handleFetchError);
}

function handleFetchResponse(response) {
  return response.json().then((data) => {
    if (data.statusCode !== "SUCCESSFUL") {
      throw new Error(data.message || "Failed to fetch data");
    }
    return data;
  });
}

function handleFetchError(error) {
  console.error("Error fetching data:", error);
}

function updateSummary(data) {
  const summaryList = document.getElementById("summary-list");
  summaryList.innerHTML = `
    <tr><td>Total Banks:</td><td><strong>${data.totalBanks}</strong></td></tr>
    <tr><td>Total Accounts:</td><td><strong>${data.totalAccounts}</strong></td></tr>
    <tr><td>Total Pages:</td><td><strong>${data.totalPages}</strong></td></tr>
    <tr><td>Total Transactions:</td><td><strong>${data.totalTransactions}</strong></td></tr>
  `;
}

function updateAccountsList(data) {
  originalAccountData = data.accountsList.map((account) => ({
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    accountType: account.accountType,
    accountHolderName: account.accountHolderName,
    statementPeriode: account.statementPeriode,
    currency: account.currency,
    totalDeposits: account.totalDeposits,
    totalDebits: account.totalDebits,
  }));

  renderAccountsList(data.accountsList);
}

function renderAccountsList(accountsList) {
  let rows = accountsList
    .map(
      (account) => `
    <tr>
      <td class="text-start">${account.accountNumber}</td>
      <td>${account.bankName}</td>
      <td>${account.accountType}</td>
      <td>${account.accountHolderName}</td>
      <td>${account.statementPeriode}</td>
      <td>${account.currency}</td>
      <td>${account.currency} ${account.totalDeposits.toLocaleString()}</td>
      <td>${account.currency} ${account.totalDebits.toLocaleString()}</td>
      <td>${account.totalNoOfDeposits}</td>
      <td>${account.totalNoOfDebits}</td>
    </tr>`
    )
    .join("");
  document.getElementById("bs-table-body").innerHTML = rows;
  initializeDataTable("#bs-table", {
    ordering: false,
    buttons: ["excelHtml5", "csvHtml5"],
  });
}

function updateTransactionsActivity(data, targetCurrency = "IDR") {
  originalTransactionData = data.transactionsData;
  const transactions = convertTransactionAmounts(
    originalTransactionData,
    targetCurrency
  );
  const months = data.months;
  const pivotData = createPivotData(transactions);
  document.getElementById("accounts-activity-table-head").innerHTML =
    generateTableHead(months);
  document.getElementById("accounts-activity-table-body").innerHTML =
    generateTableBody(pivotData, months, targetCurrency);
  // initializeDataTable("#accounts-activity-table", {
  //   searching: false,
  //   paging: false,
  //   ordering: false,
  //   layout: {
  //     topStart: "info",
  //     topEnd: {
  //       buttons: ["excelHtml5", "csvHtml5"],
  //     },
  //     bottomStart: null,
  //     bottomEnd: null,
  //   },
  // });
}

function convertTransactionAmounts(transactions, targetCurrency) {
  return transactions.map((transaction) => {
    const transactionCurrency = transaction.currency;
    const fromRate = exchangeRates[transactionCurrency];
    const toRate = exchangeRates[targetCurrency];
    const convertedAmount = (transaction.amount * toRate) / fromRate;
    return {
      ...transaction,
      amount: convertedAmount,
    };
  });
}

function updatePageDetails(data) {
  const navPages = document.getElementById("nav-pages");
  navPages.innerHTML = "";

  const pages = data.pages;
  if (!pages || pages.length === 0) {
    navPages.innerHTML = `<div class="p-4 text-center text-muted">No page details available</div>`;
    return;
  }

  // Page Navigation Header Bar
  const navBar = document.createElement("div");
  navBar.className = "d-flex justify-content-between align-items-center bg-light p-3 rounded-3 mb-3 border flex-wrap gap-2";

  let dropdownOptions = "";
  let pillButtons = "";

  pages.forEach((page, index) => {
    dropdownOptions += `<option value="${page.id}">Halaman ${index + 1}</option>`;
    pillButtons += `<button type="button" class="btn btn-sm ${index === 0 ? 'btn-primary active' : 'btn-outline-secondary'} page-nav-pill px-3 py-1" data-page-id="${page.id}">Hal ${index + 1}</button>`;
  });

  navBar.innerHTML = `
    <div class="d-flex align-items-center gap-2 flex-wrap">
      <span class="fw-bold text-dark small"><i class="fa-solid fa-file-lines text-primary me-1"></i> Navigasi Halaman:</span>
      <select id="page-nav-dropdown" class="form-select form-select-sm" style="width: auto; min-width: 140px;">
        ${dropdownOptions}
      </select>
      <div class="d-inline-flex gap-1 flex-wrap ms-1" id="page-pills-container">
        ${pillButtons}
      </div>
    </div>
    <div class="d-flex align-items-center gap-2">
      <button type="button" class="btn btn-sm btn-outline-primary active" id="btn-toggle-single-page"><i class="fa-solid fa-eye me-1"></i> Tampilan Per Halaman</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-toggle-all-pages"><i class="fa-solid fa-list me-1"></i> Tampilkan Semua</button>
    </div>
  `;

  navPages.appendChild(navBar);

  const pagesWrapper = document.createElement("div");
  pagesWrapper.id = "pages-cards-wrapper";
  navPages.appendChild(pagesWrapper);

  pages.forEach((page, index) => {
    const pageContainer = createPageContainer(page, index);
    pageContainer.setAttribute("data-page-card-id", page.id);
    if (index > 0) {
      pageContainer.style.display = "none";
    }
    pagesWrapper.appendChild(pageContainer);

    const transactionTableBody = pageContainer.querySelector(
      `#page-table-${page.id} tbody`
    );
    updateTransactionTable(transactionTableBody, page.transactions);
    initializeDataTable(`#page-table-${page.id}`, {
      searching: false,
      paging: false,
      ordering: false,
      layout: {
        topStart: "info",
        topEnd: {
          buttons: ["excelHtml5", "csvHtml5"],
        },
        bottomStart: null,
        bottomEnd: null,
      },
    });
  });

  // Event Listeners for Page Switching
  const dropdown = document.getElementById("page-nav-dropdown");
  const pills = navPages.querySelectorAll(".page-nav-pill");
  const btnSingle = document.getElementById("btn-toggle-single-page");
  const btnAll = document.getElementById("btn-toggle-all-pages");

  let isSingleView = true;

  function showPageCard(targetPageId) {
    dropdown.value = targetPageId;
    pills.forEach((p) => {
      if (p.getAttribute("data-page-id") === targetPageId) {
        p.classList.add("btn-primary", "active");
        p.classList.remove("btn-outline-secondary");
      } else {
        p.classList.remove("btn-primary", "active");
        p.classList.add("btn-outline-secondary");
      }
    });

    const pageCards = pagesWrapper.querySelectorAll("[data-page-card-id]");
    pageCards.forEach((card) => {
      if (isSingleView) {
        if (card.getAttribute("data-page-card-id") === targetPageId) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      } else {
        card.style.display = "block";
      }
    });
  }

  dropdown.addEventListener("change", function () {
    showPageCard(this.value);
  });

  pills.forEach((p) => {
    p.addEventListener("click", function () {
      const pageId = this.getAttribute("data-page-id");
      showPageCard(pageId);
    });
  });

  btnSingle.addEventListener("click", function () {
    isSingleView = true;
    btnSingle.classList.add("active", "btn-outline-primary");
    btnSingle.classList.remove("btn-outline-secondary");
    btnAll.classList.remove("active", "btn-outline-primary");
    btnAll.classList.add("btn-outline-secondary");
    showPageCard(dropdown.value);
  });

  btnAll.addEventListener("click", function () {
    isSingleView = false;
    btnAll.classList.add("active", "btn-outline-primary");
    btnAll.classList.remove("btn-outline-secondary");
    btnSingle.classList.remove("active", "btn-outline-primary");
    btnSingle.classList.add("btn-outline-secondary");
    const pageCards = pagesWrapper.querySelectorAll("[data-page-card-id]");
    pageCards.forEach((card) => (card.style.display = "block"));
  });

  setupPageEventListeners();
}

function initializeDataTable(selector, options = {}) {
  if ($.fn.DataTable.isDataTable(selector)) {
    try {
      $(selector).DataTable().clear().destroy();
    } catch (e) {
      console.warn("DataTable destroy error:", e);
    }
  }
  $(selector).DataTable({
    destroy: true,
    ...options,
  });
}

function createPivotData(transactions) {
  const pivotData = {};
  transactions.forEach(({ type, category, subcategory, month, amount }) => {
    pivotData[type] = pivotData[type] || {};
    pivotData[type][category] = pivotData[type][category] || {};
    pivotData[type][category][subcategory] =
      pivotData[type][category][subcategory] || {};
    pivotData[type][category][subcategory][month] =
      (pivotData[type][category][subcategory][month] || 0) + amount;
  });
  return pivotData;
}

function generateTableHead(months) {
  return `<tr class="align-middle">
            <th class="text-center">Type</th>
            <th class="text-center">Category</th>
            <th class="text-center">Subcategory</th>
            ${months
              .map((month) => `<th class="text-center">${month}</th>`)
              .join("")}
            <th class="text-center">Total</th>
          </tr>`;
}

function generateTableBody(pivotData, months, targetCurrency) {
  let tableBody = "";
  const categoryOrder = ["Business", "Non-Business", "Unknown"];

  for (const type in pivotData) {
    const typeCategories = Object.keys(pivotData[type]).sort(
      (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
    );
    let typeRowspan = typeCategories.reduce(
      (acc, category) => acc + Object.keys(pivotData[type][category]).length,
      0
    );
    let typeFirstRow = true;

    typeCategories.forEach((category) => {
      const subcategories = Object.keys(pivotData[type][category]);
      subcategories.forEach((subcategory, subIndex) => {
        let row = `<tr>`;
        if (typeFirstRow) {
          row += `<td rowspan="${typeRowspan}">${type}</td>`;
          typeFirstRow = false;
        } else {
          row += `<td style="display:none"></td>`;
        }
        if (subIndex === 0) {
          row += `<td rowspan="${subcategories.length}">${category}</td>`;
        } else {
          row += `<td style="display:none"></td>`;
        }
        row += `<td>${subcategory}</td>`;
        let rowTotal = 0;
        months.forEach((month) => {
          const value = pivotData[type][category][subcategory][month] || 0;
          row += `<td>${value.toFixed(2)}</td>`;
          rowTotal += value;
        });
        row += `<td><strong>${rowTotal.toFixed(2)}</strong></td></tr>`;
        tableBody += row;
      });
    });
  }
  return tableBody;
}

function createPageContainer(page, index) {
  const {
    id,
    source,
    bankName,
    accountNumber,
    accountType,
    accountHolderName,
    statementPeriode,
    currency,
    transactions,
  } = page;
  const pageContainer = document.createElement("div");
  pageContainer.className = "container-fluid border border-top-0 p-3 bg-white";
  pageContainer.innerHTML = `
    <div class="shadow container-fluid bg-white p-3 mt-3">
      <div class="row p-3">
        <div class="col border">
          <img src="/${source}" class="img-fluid" alt="Page Image" />
        </div>
        <div class="col">
          <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-1 border-bottom">
            <h1 class="h6">Page ${index + 1}</h1>
            <div>
              <button id="add-row-${id}" class="btn btn-sm btn-outline-primary d-none add-row-button" data-page-id="${id}">
                <i class="fas fa-plus"></i> Add Row
              </button>
              <button id="cancel-button-${id}" class="btn btn-sm btn-outline-danger d-none cancel-button" data-page-id="${id}">
                <i class="fas fa-xmark"></i>
              </button>
              <button class="btn btn-sm btn-outline-warning edit-button" data-page-id="${id}">
                <i class="fas fa-pen"></i>
              </button>
            </div>
          </div>
          <div class="table-responsive">
            <table id="page-summary-${id}" class="table table-borderless w-auto mb-0">
              <tr><td>Bank Name:</td><td><strong class="editable">${bankName}</strong></td></tr>
              <tr><td>Account Number:</td><td><strong class="editable">${accountNumber}</strong></td></tr>
              <tr><td>Account Type:</td><td><strong class="editable">${accountType}</strong></td></tr>
              <tr><td>Account Holder Name:</td><td><strong class="editable">${accountHolderName}</strong></td></tr>
              <tr><td>Statement Periode:</td><td><strong class="editable">${statementPeriode}</strong></td></tr>
              <tr><td>Currency:</td><td><strong class="editable">${currency}</strong></td></tr>
            </table>
          </div>
          <div class="table-responsive">
            <table id="page-table-${id}" class="table table-custom table-hover">
              <thead>
                <tr class="align-middle">
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Type</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
  return pageContainer;
}

function updateTransactionTable(tableBody, transactions) {
  transactions.forEach(({ id, date, description, type, amount }) => {
    const formattedDate = new Date(date).toLocaleDateString();
    const row = `
      <tr data-transaction-id="${id}">
        <td class="editable date">${formattedDate}</td>
        <td class="editable">${description}</td>
        <td class="editable">${type}</td>
        <td class="editable">${amount.toFixed(2)}</td>
        <td class="actions text-center">
          <button class="btn btn-sm btn-outline-danger delete-row-button" disabled><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
    tableBody.insertAdjacentHTML("beforeend", row);
  });
}

function setupPageEventListeners() {
  document.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => toggleEditMode(button));
  });

  document.querySelectorAll(".cancel-button").forEach((button) => {
    button.addEventListener("click", () => cancelEditMode(button));
  });

  document.querySelectorAll(".add-row-button").forEach((button) => {
    button.addEventListener("click", () =>
      addRow(button.getAttribute("data-page-id"))
    );
  });

  document.querySelectorAll(".delete-row-button").forEach((button) => {
    button.addEventListener("click", () => deleteRow(button));
  });
}

let editMode = false;
let currentEditPageId = null;

function toggleEditMode(button) {
  const pageId = button.getAttribute("data-page-id");

  if (editMode && currentEditPageId !== pageId) {
    alert(
      "Please save or cancel the current edit mode before editing another section."
    );
    return;
  }

  const pageSummary = document.getElementById(`page-summary-${pageId}`);
  const editableElements = pageSummary.querySelectorAll(".editable");
  const transactionTable = document.querySelector(`#page-table-${pageId}`);
  const transactionCells = transactionTable.querySelectorAll(".editable");

  toggleEditableElements(editableElements, transactionCells, pageId);

  if (button.querySelector("i").classList.contains("fa-pen")) {
    enterEditMode(button, pageId);
  } else {
    exitEditMode(button, pageId);
    saveChanges(pageId);
  }
}

function toggleEditableElements(editableElements, transactionCells, pageId) {
  editableElements.forEach((element) => {
    element.contentEditable = element.contentEditable !== "true";
    element.classList.toggle("editing");
  });

  transactionCells.forEach((cell) => {
    cell.contentEditable = cell.contentEditable !== "true";
    cell.classList.toggle("editing");
  });

  document
    .querySelectorAll(`#page-table-${pageId} .actions .btn`)
    .forEach((btn) => {
      btn.disabled = !btn.disabled;
    });
}

function enterEditMode(button, pageId) {
  editMode = true;
  currentEditPageId = pageId;
  button.querySelector("i").classList.replace("fa-pen", "fa-save");
  button.classList.replace("btn-outline-warning", "btn-outline-success");
  document.getElementById(`cancel-button-${pageId}`).classList.remove("d-none");
  document.getElementById(`add-row-${pageId}`).classList.remove("d-none");
}

function exitEditMode(button, pageId) {
  button.querySelector("i").classList.replace("fa-save", "fa-pen");
  button.classList.replace("btn-outline-success", "btn-outline-warning");
  editMode = false;
  currentEditPageId = null;
  document.getElementById(`cancel-button-${pageId}`).classList.add("d-none");
  document.getElementById(`add-row-${pageId}`).classList.add("d-none");
}

function cancelEditMode(button) {
  const pageId = button.getAttribute("data-page-id");
  location.reload();
}

function addRow(pageId) {
  const transactionTableBody = document.querySelector(
    `#page-table-${pageId} tbody`
  );
  const row = `
    <tr>
      <td class="editable date"></td>
      <td class="editable"></td>
      <td class="editable"></td>
      <td class="editable"></td>
      <td class="actions text-center">
        <button class="btn btn-sm btn-outline-danger delete-row-button"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `;
  transactionTableBody.insertAdjacentHTML("beforeend", row);

  const newRow = transactionTableBody.lastElementChild;
  newRow.querySelectorAll(".editable").forEach((cell) => {
    cell.contentEditable = "true";
    cell.classList.add("editing");
  });

  newRow.querySelector(".delete-row-button").addEventListener("click", () => {
    deleteRow(newRow.querySelector(".delete-row-button"));
  });
}

function deleteRow(button) {
  const row = button.closest("tr");
  row.remove();
}

function saveChanges(pageId) {
  $("#loadingModal").modal("show");
  const pageSummary = document.getElementById(`page-summary-${pageId}`);
  const editedData = extractPageSummaryData(pageSummary);
  const transactions = extractTransactionTableData(pageId);

  const updatedPage = {
    id: pageId,
    ...editedData,
    transactions: transactions,
  };

  fetch(`/api/faas/bs/v1/page`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedPage),
  })
    .then(handleFetchResponse)
    .then(() => {
      alert("Changes saved successfully");
      location.reload();
    })
    .catch((error) => console.error("Error saving changes:", error))
    .finally(() => {
      $("#loadingModal").modal("hide");
    });
}

function extractPageSummaryData(pageSummary) {
  const data = {};
  pageSummary.querySelectorAll("tr").forEach((row) => {
    const key = row.children[0].textContent
      .replace(":", "")
      .trim()
      .replace(/\s+/g, "");
    const loweredKey = key.charAt(0).toLowerCase() + key.slice(1);
    const value = row.children[1].textContent.trim();
    data[loweredKey] = value;
  });
  return data;
}

function extractTransactionTableData(pageId) {
  const transactions = [];
  const transactionRows = document
    .querySelector(`#page-table-${pageId}`)
    .querySelectorAll("tbody tr");
  transactionRows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    const transaction = {
      id: row.getAttribute("data-transaction-id"),
      date: cells[0].textContent.trim(),
      description: cells[1].textContent.trim(),
      type: cells[2].textContent.trim(),
      amount: parseFloat(cells[3].textContent.trim()),
    };
    transactions.push(transaction);
  });
  return transactions;
}

// Categorization
let editModeCategorization = false;

function setupEditModeToggle() {
  document
    .getElementById("edit-mode-categorization-toggle")
    .addEventListener("click", function () {
      if (editModeCategorization) {
        $("#loadingModal").modal("show");
        const categories = [];
        // Collect data for Business categories
        const businessCategories = collectCategoryData("business-categories");
        categories.push({
          name: "Business",
          subcategories:
            businessCategories.length > 0 ? businessCategories : [],
        });

        // Collect data for Non-Business categories
        const nonBusinessCategories = collectCategoryData(
          "non-business-categories"
        );
        categories.push({
          name: "Non-Business",
          subcategories:
            nonBusinessCategories.length > 0 ? nonBusinessCategories : [],
        });

        const requestData = {
          bsId: statementId,
          categories: categories,
        };
        // Send data to the API
        fetch("/api/faas/bs/v1/subcategories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        })
          .then((response) => response.json())
          .then((data) => {
            alert(data.message);
            location.reload();
          })
          .catch((error) => console.error("Error:", error))
          .finally(() => {
            $("#loadingModal").modal("hide");
          });
      }
      editModeCategorization = !editModeCategorization;
      toggleEditModeCategorization();
    });
}

function collectCategoryData(categoryContainerId) {
  const categories = [];
  const categoryContainer = document.getElementById(categoryContainerId);
  const subcategoryCards = categoryContainer.querySelectorAll(".card");

  subcategoryCards.forEach((card) => {
    const subcategoryName = card
      .querySelector(".subcategory-title")
      .textContent.trim();
    const keywords = Array.from(card.querySelectorAll(".keyword-text")).map(
      (keywordElement) => {
        return keywordElement.textContent.trim();
      }
    );

    const keywordList = keywords.length > 0 ? keywords : [];

    if (subcategoryName) {
      categories.push({
        subcategoryName: subcategoryName,
        keywords: keywordList,
      });
    }
  });

  return categories;
}

function toggleEditModeCategorization() {
  const editModeElements = document.querySelectorAll(".edit-mode-only");
  editModeElements.forEach((element) => {
    element.style.display = editModeCategorization ? "inline-block" : "none";
  });
  const toggleButtonIcon = document
    .getElementById("edit-mode-categorization-toggle")
    .querySelector("i");
  toggleButtonIcon.classList.toggle("fa-pen", !editModeCategorization);
  toggleButtonIcon.classList.toggle("fa-save", editModeCategorization);
  makeCategorizationEditable(editModeCategorization);
}

function makeCategorizationEditable(isEditable) {
  const subcategoryTitles = document.querySelectorAll(".subcategory-title");
  const keywordTexts = document.querySelectorAll(".keyword-text");

  subcategoryTitles.forEach((title) => {
    title.contentEditable = isEditable;
    title.classList.toggle("editable", isEditable);
  });

  keywordTexts.forEach((keyword) => {
    keyword.contentEditable = isEditable;
    keyword.classList.toggle("editable", isEditable);
  });
}

function addKeyword(categoryId) {
  const keywordId = `keyword-${new Date().getTime()}`;
  const keywordHtml = `
  <div class="d-flex" id="${keywordId}">
  <button class="btn btn-sm btn-outline-danger border-0 edit-mode-only" onclick="removeElement('${keywordId}')">
        <i class="fas fa-xmark"></i>
      </button>
      <p class="shadow-sm rounded card-text border p-1 px-3 m-1 keyword-text">
      New Keyword
    </p>
  </div>
    
  `;
  document
    .getElementById(`${categoryId}-keywords`)
    .insertAdjacentHTML("beforeend", keywordHtml);
  toggleEditModeCategorization();
}

const addSubcategoryModal = document.getElementById("addSubcategoryModal");
if (addSubcategoryModal) {
  addSubcategoryModal.addEventListener("show.bs.modal", (event) => {
    const button = event.relatedTarget;
    const mainCategory = button.getAttribute("data-bs-whatever");
    const modalTitle = addSubcategoryModal.querySelector(".modal-title");
    modalTitle.textContent = `Add ${mainCategory} Subcategory`;
    addSubcategoryModal.querySelector("#category-name").value = mainCategory;
  });
}

document
  .getElementById("add-category-button")
  .addEventListener("click", function () {
    const categoryName = document.getElementById("category-name").value;
    const subcategoryName = document.getElementById("subcategory-name").value;

    if (!subcategoryName) {
      alert("Subcategory Name is required.");
      return;
    }

    addSubcategoryCard(categoryName, subcategoryName);

    $("#addSubcategoryModal").modal("hide");
    document.getElementById("subcategory-name").value = "";
  });

function addSubcategoryCard(category, subcategoryName) {
  const categoryContainerId =
    category === "Business" ? "business-categories" : "non-business-categories";
  const categoryContainer = document.getElementById(categoryContainerId);
  const categoryId = `category-${new Date().getTime()}`;

  const categoryHtml = `
    <div class="col-3 me-3 mb-3" id="${categoryId}">
      <div class="card text-dark bg-light me-3" style="width: 300px">
        <div class="card-header d-flex w-100 justify-content-between align-items-center">
          <span class="subcategory-title">${subcategoryName}</span>
          <button class="btn btn-sm btn-outline-danger float-right border-0 edit-mode-only" onclick="removeElement('${categoryId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="card-body" id="${categoryId}-keywords"></div>
        <button class="btn btn-sm btn-outline-primary float-right edit-mode-only mx-4 mb-3" onclick="addKeyword('${categoryId}')">
          <i class="fas fa-plus"></i> Add Keyword
        </button>
      </div>
    </div>
  `;
  categoryContainer.insertAdjacentHTML("beforeend", categoryHtml);
  toggleEditModeCategorization();
}

function removeElement(elementId) {
  const element = document.getElementById(elementId);
  element.parentNode.removeChild(element);
}

function fetchCategories() {
  fetch("/api/faas/bs/v1/subcategories?bsId=" + statementId)
    .then((response) => response.json())
    .then((data) => {
      populateCategories(data.categories);
    })
    .catch((error) => console.error("Error fetching categories:", error));
}

function populateCategories(categories) {
  categories.forEach((category) => {
    const categoryName = category.name;
    category.subcategories.forEach((subcategory) => {
      addSubcategoryCard(
        categoryName,
        subcategory.subcategoryName,
        subcategory.keywords
      );
    });
  });
}

function addSubcategoryCard(category, subcategoryName, keywords = []) {
  const categoryContainerId =
    category === "Business" ? "business-categories" : "non-business-categories";
  const categoryContainer = document.getElementById(categoryContainerId);
  const categoryId = `category-${uuid.v4()}`;

  const categoryHtml = `
    <div class="col-3 me-3 mb-3" id="${categoryId}">
      <div class="card text-dark bg-light me-3" style="width: 300px">
        <div class="card-header d-flex w-100 justify-content-between align-items-center">
          <span class="subcategory-title">${subcategoryName}</span>
          <button class="btn btn-sm btn-outline-danger float-right border-0 edit-mode-only" onclick="removeElement('${categoryId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="card-body" id="${categoryId}-keywords">
        ${keywords
          .map((keyword) => {
            const keywordId = `keyword-${uuid.v4()}`;
            return `
                <div class="d-flex" id="${keywordId}">
                  <button class="btn btn-sm btn-outline-danger border-0 edit-mode-only" onclick="removeElement('${keywordId}')">
                    <i class="fas fa-xmark"></i>
                  </button>
                  <p class="shadow-sm rounded card-text border p-1 px-3 m-1 keyword-text">
                    ${keyword}
                  </p>
                </div>
              `;
          })
          .join("")}
        </div>
        <button class="btn btn-sm btn-outline-primary float-right edit-mode-only mx-4 mb-3" onclick="addKeyword('${categoryId}')">
          <i class="fas fa-plus"></i> Add Keyword
        </button>
      </div>
    </div>
  `;
  categoryContainer.insertAdjacentHTML("beforeend", categoryHtml);
  toggleEditModeCategorization();
}
