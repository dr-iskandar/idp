document.addEventListener("DOMContentLoaded", function () {
  setupTabNavigation();
  fetchSummary();
  fetchAttachments();
  fetchConsistency();
  setupSubmitMainTypeButton();
  fetchDocuments();
});

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
  fetch(`/api/tf/v1/summary?tfId=${recordId}`)
    .then(handleFetchResponse)
    .then(updateSummary)
    .catch(handleFetchError);
}

function updateSummary(data) {
  const summaryList = document.getElementById("summary-list");
  summaryList.innerHTML = `
      <tr><td>Transaction ID</td><td><strong>${data.tradeFinanceRecords.id}</strong></td></tr>
      <tr><td>File Name</td><td><strong>${data.tradeFinanceRecords.title}</strong></td></tr>
      <tr><td>Created Date</td><td><strong>${data.tradeFinanceRecords.createdAt}</strong></td></tr>
      <tr><td>Company</td><td><strong>${data.tradeFinanceRecords.company}</strong></td></tr>
      <tr><td>Menu</td><td><strong>${data.tradeFinanceRecords.menu}</strong></td></tr>
      <tr><td>Manual Supervisor</td><td><strong>${data.tradeFinanceRecords.manualSupervisor}</strong></td></tr>
    `;
}

function fetchAttachments() {
  fetch(`/api/tf/v1/attachments?tfId=${recordId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        updateAttachmentTable(data.attachments);
      } else {
        console.error("Error fetching attachments:", data.message);
      }
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
    });
}

function updateAttachmentTable(attachments) {
  const tableBody = document.getElementById("attachment-table-body");
  tableBody.innerHTML = "";

  attachments.forEach((attachment, index) => {
    const row = document.createElement("tr");
    row.classList.add("align-middle");

    row.innerHTML = `
        <td>${index + 1}</td>
        <td>${attachment.documentId}</td>
        <td>${attachment.documentName}</td>
        <td>${attachment.documentDescription}</td>
        <td>${attachment.documentType}</td>
        <td>${attachment.totalPages}</td>
      `;

    tableBody.appendChild(row);
  });
}

function fetchConsistency() {
  fetch(`/api/tf/v1/consistency?tfId=${recordId}`)
    .then(handleFetchResponseForConsistency)
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

function handleFetchResponseForConsistency(response) {
  return response.json().then((data) => {
    if (
      data.statusCode === "FAILED" &&
      data.message === "Please choose main document"
    ) {
      const radioButtonsContainer = document.getElementById(
        "modal-radio-buttons"
      );
      radioButtonsContainer.innerHTML = data.data
        .map(
          (doc, index) => `
        <div class="form-check">
          <input class="form-check-input" type="radio" name="mainDocument" id="mainDocument${index}" value="${doc.documentId}">
          <label class="form-check-label" for="mainDocument${index}">
            <strong>${doc.documentType}</strong> | ${doc.documentName}
          </label>
        </div>
      `
        )
        .join("");

      var myModal = new bootstrap.Modal(
        document.getElementById("staticBackdrop")
      );
      myModal.show();
    } else if (data.statusCode !== "SUCCESSFUL") {
      throw new Error(data.message || "Failed to fetch data");
    }
    return data;
  });
}

function setupSubmitMainTypeButton() {
  const submitButton = document.getElementById("submit-main-type-button");
  submitButton.addEventListener("click", function () {
    const selectedRadio = document.querySelector(
      'input[name="mainDocument"]:checked'
    );
    if (selectedRadio) {
      const selectedDocumentId = selectedRadio.value;
      changeMainDocument(selectedDocumentId);
    } else {
      alert("Please select a document type.");
    }
  });
}

function changeMainDocument(docId) {
  $("#staticBackdrop").modal("hide");
  $("#loadingModal").modal("show");
  fetch(`/api/tf/v1/main?docId=${docId}`, {
    method: "PUT",
  })
    .then(handleFetchResponse)
    .then((data) => {
      $("#loadingModal").modal("hide");
      alert("Main document updated successfully.");
      location.reload();
    })
    .catch(handleFetchError);
}

function fetchDocuments() {
  fetch(`/api/tf/v1/consistency?tfId=${recordId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        createDocumentTable(data.data);
        $(function () {
          $('[data-toggle="tooltip"]').tooltip();
        });
        populateData(data.data);
      } else {
        console.error("Error fetching documents:", data.message);
      }
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
    });
}

function createDocumentTable(documents) {
  const container = document.getElementById("document-table-container");
  const table = document.createElement("table");
  table.className = "table table-custom ";

  documents.sort((a, b) => b.main - a.main);
  const colgroup = document.createElement("colgroup");

  const colParameter = document.createElement("col");
  colParameter.className = "parameter-column";
  colgroup.appendChild(colParameter);

  documents.forEach(() => {
    const colDocument = document.createElement("col");
    colDocument.className = "document-column";
    colgroup.appendChild(colDocument);
  });

  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const parameterHeader = document.createElement("th");
  parameterHeader.className = "parameter-column";
  parameterHeader.textContent = "Fields to Check";
  headerRow.appendChild(parameterHeader);

  documents.forEach((doc) => {
    const header = document.createElement("th");
    header.className = "document-column";
    header.textContent = `${doc.documentType}`;
    headerRow.appendChild(header);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const parameters = [
    "fieldLCNo",
    "fieldBeneficiary",
    "fieldDrawee",
    "fieldCustomer",
    "fieldCurrency",
    "fieldAmount",
    "fieldTenor",
  ];

  const tbody = document.createElement("tbody");

  parameters.forEach((param) => {
    const row = document.createElement("tr");

    const paramCell = document.createElement("td");
    paramCell.className = "parameter-column";

    let paramText = param;
    let allAbove90 = true;
    let anyBelow20 = false;
    const mainDoc = documents[0][param] || "";

    documents.forEach((doc, index) => {
      const valueCell = document.createElement("td");
      valueCell.className = "document-column";
      if (index === 0) {
        valueCell.textContent = mainDoc;
      } else {
        const similarity = similarityPercentage(mainDoc, doc[param] || "");
        valueCell.innerHTML = `<span data-toggle="tooltip" title="${similarity}%">${
          doc[param] || ""
        }</span>`;

        if (similarity < 20) {
          anyBelow20 = true;
        }
        if (similarity < 90) {
          allAbove90 = false;
        }
      }
      row.appendChild(valueCell);
    });

    if (allAbove90) {
      paramText += ' <i class="fa-solid fa-circle-check text-success"></i>';
    } else if (anyBelow20) {
      paramText += ' <i class="fa-solid fa-circle-xmark text-danger"></i>';
    } else {
      paramText +=
        ' <i class="fa-solid fa-circle-exclamation text-warning"></i>';
    }

    paramCell.innerHTML = paramText;
    row.insertBefore(paramCell, row.firstChild);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function populateData(documents) {
  const navigation = document.getElementById("navigation-page");
  const pageSource = document.getElementById("page-source");
  // const parameters = document.getElementById("parameters");

  navigation.innerHTML = "";
  pageSource.innerHTML = "";
  // parameters.innerHTML = "";

  documents.forEach((doc, docIndex) => {
    const navItem = document.createElement("a");
    navItem.textContent = doc.documentType;
    navItem.style.cursor = "pointer";
    navItem.className = "nav-link border-bottom w-100";
    navItem.onclick = () => showDocument(docIndex);
    navigation.appendChild(navItem);

    const pageContainer = document.createElement("div");
    pageContainer.className = "page-container";
    doc.pages.forEach((page, pageIndex) => {
      const img = document.createElement("img");
      img.src = `/${page}`;
      img.alt = `Page ${pageIndex + 1}`;
      img.className = "img-fluid";
      if (pageIndex === 0) img.classList.add("active");
      pageContainer.appendChild(img);
    });

    pageSource.appendChild(pageContainer);

    // Parameters
    const paramList = document.createElement("ul");
    Object.keys(doc).forEach((key) => {
      if (key.startsWith("field")) {
        const paramItem = document.createElement("li");
        paramItem.textContent = `${key}: ${doc[key]}`;
        paramList.appendChild(paramItem);
      }
    });
    // parameters.appendChild(paramList);
  });
  showDocument(0);
}

function showDocument(docIndex) {
  const pageContainers = document.querySelectorAll(".page-container");
  const navItems = document.querySelectorAll("#navigation-page .nav-link");

  pageContainers.forEach((container, index) => {
    container.style.display = index === docIndex ? "block" : "none";
  });

  navItems.forEach((navItem, index) => {
    if (index === docIndex) {
      navItem.classList.add("active");
    } else {
      navItem.classList.remove("active");
    }
  });
}

function handleFetchError(error) {
  console.error("Error fetching data:", error);
}

function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: an + 1 }, () => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[i][0] = i;
  for (let j = 0; j <= bn; j++) matrix[0][j] = j;

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

function similarityPercentage(a, b) {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 100;
  return ((1 - distance / maxLength) * 100).toFixed(2);
}
