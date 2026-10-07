document.addEventListener("DOMContentLoaded", function () {
  fetchPageDetails();
});

function fetchPageDetails() {
  fetch(`/api/faas/fs/v1/pages/details?fsId=${statementId}`)
    .then(handleFetchResponse)
    .then(updatePageDetails)
    .catch(handleFetchError);
}

function updatePageDetails(data) {
  const pages = data.pages;
  const container = document.querySelector(".shadow.container-fluid");

  const orderOfDocumentTypes = [
    "Balance Sheet",
    "Income Statement",
    "Cash Flow Statement",
  ];

  pages.sort((a, b) => {
    return (
      orderOfDocumentTypes.indexOf(a.documentType) -
      orderOfDocumentTypes.indexOf(b.documentType)
    );
  });

  // Clear existing content
  container.innerHTML = "";

  pages.forEach((page, index) => {
    const pageContent = createPageContent(page, index);
    container.appendChild(pageContent);

    const financialTableBody = pageContent.querySelector(
      `#page-table-${page.id} tbody`
    );
    updateFinancialTable(financialTableBody, page.data, page.years);
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

  setupPageEventListeners();
}

function updateFinancialTable(tableBody, data, years) {
  data.forEach(({ field, ...values }) => {
    const formattedField = camelCaseToTitleCase(field);
    const row = `
      <tr data-field="${field}">
        <td>${formattedField}</td>
        ${years
          .map((year) => `<td class="editable">${values[year] || ""}</td>`)
          .join("")}
      </tr>
    `;
    tableBody.insertAdjacentHTML("beforeend", row);
  });
}

function createPageContent(page, index) {
  const { id, source, documentType, companyName, years, fields } = page;
  const pageContent = document.createElement("div");
  pageContent.className = "row p-3 mb-4";

  const imageCarousel = createImageCarousel(id, source);

  pageContent.innerHTML = `
    <div class="col border">
      ${imageCarousel}
    </div>
    <div class="col">
      <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-1 border-bottom">
        <h1 id="document-type-${id}" class="h6">${documentType}</h1>
        <div>
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
          <tr><td>Company Name:</td><td><strong class="editable">${companyName}</strong></td></tr>
          <tr><td>Years:</td><td><strong class="editable">${years.join(
            ", "
          )}</strong></td></tr>
        </table>
      </div>
      <div class="table-responsive">
        <table id="page-table-${id}" class="table table-custom table-hover">
          <thead>
            <tr class="align-middle">
              <th class="text-center" scope="col">Field</th>
              ${years
                .map(
                  (year) => `<th class="text-center" scope="col">${year}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  return pageContent;
}
function createImageCarousel(id, sources) {
  if (sources.length === 1) {
    return `<img src="/${sources[0]}" class="img-fluid" alt="Page Image" />`;
  }

  const carouselItems = sources
    .map(
      (src, index) => `
    <div class="carousel-item ${index === 0 ? "active" : ""}">
      <img src="/${src}" class="d-block w-100" alt="Page Image ${index + 1}">
    </div>
  `
    )
    .join("");

  return `
    <div id="carousel-${id}" class="carousel slide" data-bs-ride="carousel">
      <div class="carousel-inner">
        ${carouselItems}
      </div>
      <button class="carousel-control-prev" type="button" data-bs-target="#carousel-${id}" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#carousel-${id}" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
    </div>
  `;
}

function initializeDataTable(selector, options = {}) {
  $(selector).DataTable({
    ...options,
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

function setupPageEventListeners() {
  document.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => toggleEditMode(button));
  });

  document.querySelectorAll(".cancel-button").forEach((button) => {
    button.addEventListener("click", () => cancelEditMode(button));
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
    ``;
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
}

function exitEditMode(button, pageId) {
  button.querySelector("i").classList.replace("fa-save", "fa-pen");
  button.classList.replace("btn-outline-success", "btn-outline-warning");
  editMode = false;
  currentEditPageId = null;
  document.getElementById(`cancel-button-${pageId}`).classList.add("d-none");
}

function cancelEditMode(button) {
  const pageId = button.getAttribute("data-page-id");
  location.reload();
}

function saveChanges(pageId) {
  $("#loadingModal").modal("show");
  const pageSummary = document.getElementById(`page-summary-${pageId}`);
  const pageTable = document.getElementById(`page-table-${pageId}`);
  const documentType = document
    .getElementById(`document-type-${pageId}`)
    .textContent.trim();
  const pageData = extractPageSummaryData(pageSummary, pageTable);
  const updatedPage = {
    id: pageId,
    documentType: documentType,
    ...pageData,
    data: extractTransactionTableData(pageId, pageData.years),
  };

  fetch(`/api/faas/fs/v1/page`, {
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

function extractPageSummaryData(pageSummary, pageTable) {
  const data = {};

  // Extract company name
  const companyNameRow = pageSummary.querySelector("tr:nth-child(1)");
  data.companyName = companyNameRow.children[1].textContent.trim();

  // Extract years
  const yearsRow = pageSummary.querySelector("tr:nth-child(2)");
  data.years = yearsRow.children[1].textContent
    .split(",")
    .map((year) => year.trim());

  // Extract fields
  data.fields = Array.from(pageTable.querySelectorAll("tbody tr")).map((row) =>
    row.children[0].textContent.trim()
  );

  return data;
}

function extractTransactionTableData(pageId, years) {
  const transactions = [];
  const transactionRows = document
    .querySelector(`#page-table-${pageId}`)
    .querySelectorAll("tbody tr");

  transactionRows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    const transaction = {
      field: row.getAttribute("data-field"), // Use the original field name
    };

    // Add year data dynamically
    years.forEach((year, index) => {
      const cellValue = cells[index + 1].textContent.trim();
      transaction[year] = cellValue === "" ? null : cellValue;
    });

    transactions.push(transaction);
  });

  return transactions;
}
function camelCaseToTitleCase(str) {
  // Add space before capital letters
  const spaced = str.replace(/([A-Z])/g, " $1");
  // Capitalize the first letter and trim any leading space
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).trim();
}
