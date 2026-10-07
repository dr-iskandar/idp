document.addEventListener("DOMContentLoaded", function () {
  initializeDataTable();
  setupFileInputHandler();
  setupFormSubmitHandler();
});

let tableDebounceTimer = null;
function debouncedInitializeDataTable() {
  if (tableDebounceTimer) clearTimeout(tableDebounceTimer);
  tableDebounceTimer = setTimeout(() => {
    initializeDataTable();
  }, 250);
}

function initializeDataTable() {
  fetch("/api/tf/v1/list")
    .then((response) => {
      if (response.status === 403) {
        throw new Error("Access Forbidden");
      }
      return response.json();
    })
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        if (data.tradeFinanceRecords && data.tradeFinanceRecords.length > 0) {
          populateTable(data.tradeFinanceRecords);
        } else {
          displayNoRecordsMessage();
        }
      } else {
        displayNoRecordsMessage();
        console.error("Failed to fetch trade finance records:", data.message);
      }
    })
    .catch((error) => {
      if (error.message === "Access Forbidden") {
        lockPage("You do not have analyst access to view this page.");
      } else {
        displayNoRecordsMessage();
        console.error("Error fetching financial statements:", error);
      }
    });
}

function displayNoRecordsMessage() {
  if ($.fn.DataTable.isDataTable("#tf-table")) {
    try {
      $("#tf-table").DataTable().clear().destroy();
    } catch (e) {
      console.warn("DataTable destroy error:", e);
    }
  }

  const tableBody = document.getElementById("tf-table-body");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center">No records found</td>
      </tr>
    `;
  }
}
function lockPage(message) {
  // Remove all content from the page
  document.querySelector(".container-fluid").innerHTML = "";

  // Create a centered message
  const lockMessage = document.createElement("div");
  lockMessage.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    font-size: 24px;
    color: #721c24;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    padding: 20px;
    border-radius: 5px;
  `;
  lockMessage.textContent = message;

  // Add the message to the body
  document.body.appendChild(lockMessage);

  // Optionally, you can add a logout button
  lockMessage.appendChild(document.createElement("br"));
}

function populateTable(tradeFinanceRecords) {
  if (!tradeFinanceRecords || tradeFinanceRecords.length === 0) {
    displayNoRecordsMessage();
    return;
  }

  if ($.fn.DataTable.isDataTable("#tf-table")) {
    try {
      $("#tf-table").DataTable().clear().destroy();
    } catch (e) {
      console.warn("DataTable destroy error:", e);
    }
  }

  const tableBody = document.getElementById("tf-table-body");
  let tab = "";

  tradeFinanceRecords.forEach((record) => {
    let statusBadge = "";
    if (record.status === "Finished") {
      statusBadge = `<span class="text-success small fw-semibold align-items-center d-inline-flex"><i class="fa-solid fa-circle-check me-1.5 fs-6"></i> Finished</span>`;
    } else if (record.status === "Error") {
      statusBadge = `<span class="text-danger small fw-semibold align-items-center d-inline-flex"><i class="fa-solid fa-circle-xmark me-1.5 fs-6"></i> Error</span>`;
    } else {
      statusBadge = `<span class="text-warning small fw-semibold align-items-center d-inline-flex"><i class="fa-solid fa-spinner fa-spin me-1.5 fs-6"></i> Processing</span>`;
    }

    tab += `
      <tr>
        <td class="text-center">${record.createdAt}</td>
        <td class="text-center">${record.id}</td>
        <td class="text-center">${record.title}</td>
        <td class="text-center">${record.company}</td>
        <td class="text-center">${record.menu}</td>
        <td class="text-center">${record.totalDocumentTypes}</td>
        <td class="text-center">${record.totalPages}</td>
        <td class="text-center">${record.manualSupervisor}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-primary view-btn" data-id="${record.id}">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger delete-btn" data-id="${record.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = tab;
  $("#tf-table").DataTable({
    destroy: true,
    order: [[0, "desc"]], // Sort by the first column (Created At) in descending order
  });

  // Attach event listeners to buttons
  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const recordId = this.getAttribute("data-id");
      window.location.href = `/trade-finance/details/${recordId}`;
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const recordId = this.getAttribute("data-id");
      if (typeof window.showConfirmModal === "function") {
        window.showConfirmModal({
          title: "Hapus Rekaman",
          message: "Apakah Anda yakin ingin menghapus rekaman Trade Finance ini?",
          confirmText: "Ya, Hapus",
          onConfirm: () => deleteRecord(recordId)
        });
      } else if (confirm("Are you sure you want to delete this record?")) {
        deleteRecord(recordId);
      }
    });
  });
}

function deleteRecord(recordId) {
  fetch(`/api/tf/v1/delete?tfId=${recordId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        if (typeof window.showToast === "function") window.showToast("Dokumen Trade Finance berhasil dihapus.", "success");
        debouncedInitializeDataTable();
      } else {
        if (typeof window.showToast === "function") window.showToast(data.message || "Gagal menghapus rekaman", "error");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function setupFileInputHandler() {
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");

  fileInput.addEventListener("change", handleFileSelect);

  function handleFileSelect(event) {
    const files = event.target.files;
    fileList.innerHTML = "";

    Array.from(files).forEach((file, index) => {
      const listItem = document.createElement("li");
      listItem.className =
        "list-group-item d-flex justify-content-between align-items-center";
      listItem.textContent = file.name;

      const removeButton = document.createElement("button");
      removeButton.className = "btn btn-danger btn-sm";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        removeFile(index);
      });

      listItem.appendChild(removeButton);
      fileList.appendChild(listItem);
    });
  }

  function removeFile(index) {
    const dataTransfer = new DataTransfer();
    const files = fileInput.files;

    for (let i = 0; i < files.length; i++) {
      if (i !== index) {
        dataTransfer.items.add(files[i]);
      }
    }

    fileInput.files = dataTransfer.files;
    handleFileSelect({ target: { files: dataTransfer.files } });
  }
}

let isBulkMode = false;

function setupFormSubmitHandler() {
  const form = document.getElementById("record-form");
  const recordTitleInput = document.getElementById("record-title");
  const recordCompanyInput = document.getElementById("record-company");
  const recordMenuInput = document.getElementById("record-menu");
  const recordManualSupervisorInput = document.getElementById(
    "record-manual-supervisor"
  );
  const btnSingle = document.getElementById("btn-single-mode");
  const btnBulk = document.getElementById("btn-bulk-mode");
  const recordFieldsContainer = document.getElementById("record-fields-container");

  if (btnSingle && btnBulk) {
    btnSingle.addEventListener("click", function () {
      isBulkMode = false;
      btnSingle.classList.add("btn-primary", "active");
      btnSingle.classList.remove("btn-outline-secondary");
      btnBulk.classList.remove("btn-primary", "active");
      btnBulk.classList.add("btn-outline-secondary");
      if (recordFieldsContainer) recordFieldsContainer.style.display = "block";
    });

    btnBulk.addEventListener("click", function () {
      isBulkMode = true;
      btnBulk.classList.add("btn-primary", "active");
      btnBulk.classList.remove("btn-outline-secondary");
      btnSingle.classList.remove("btn-primary", "active");
      btnSingle.classList.add("btn-outline-secondary");
      if (recordFieldsContainer) recordFieldsContainer.style.display = "none";
    });
  }

  document
    .getElementById("submit-button")
    .addEventListener("click", function () {
      const fileInput = document.getElementById("file-input");
      const files = Array.from(fileInput.files);

      if (!files.length) {
        if (typeof window.showToast === "function") window.showToast("Silakan pilih minimal satu berkas untuk diunggah.", "warning");
        return;
      }

      let recordTitle = "";
      let recordCompany = "General";
      let recordMenu = "Trade Finance";
      let recordManualSupervisor = 0;

      if (!isBulkMode) {
        const rawTitle = recordTitleInput ? recordTitleInput.value.trim() : "";
        recordTitle = rawTitle || (files[0] ? files[0].name.replace(/\.[^/.]+$/, "") : "Dokumen Trade Finance");
        if (recordCompanyInput && recordCompanyInput.value.trim()) {
          recordCompany = recordCompanyInput.value.trim();
        }
        if (recordMenuInput && recordMenuInput.value.trim()) {
          recordMenu = recordMenuInput.value.trim();
        }
        if (recordManualSupervisorInput) {
          recordManualSupervisor = recordManualSupervisorInput.checked ? 1 : 0;
        }
      }

      // Hide modal after validation succeeds
      const modalElement = document.getElementById("staticBackdrop");
      if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        if (modalInstance) modalInstance.hide();
      }

      if (isBulkMode) {
        if (typeof window.showToast === "function") {
          window.showToast(`Bulk upload Trade Finance: ${files.length} dokumen sedang diproses di latar belakang...`, "info", "Bulk Processing");
        }
        form.reset();
        const fileList = document.getElementById("file-list");
        if (fileList) fileList.innerHTML = "";

        files.forEach((file) => {
          const rawTitle = file.name.replace(/\.[^/.]+$/, "");
          const singleFd = new FormData();
          singleFd.append("title", rawTitle);
          singleFd.append("company", "General / Bulk");
          singleFd.append("menu", "Trade Finance");
          singleFd.append("manual_supervisor", "0");
          singleFd.append("files", file);

          fetch("/api/tf/v1/create", { method: "POST", body: singleFd })
            .then((res) => res.json())
            .then((data) => {
              if (data.statusCode === "SUCCESSFUL") {
                if (typeof window.showToast === "function") window.showToast(`Dokumen Trade Finance '${rawTitle}' selesai diproses!`, "success", "Proses Selesai");
                debouncedInitializeDataTable();
              } else {
                if (typeof window.showToast === "function") window.showToast(`Gagal memproses '${rawTitle}': ${data.message}`, "error");
              }
            })
            .catch((err) => console.error(err));
        });
      } else {
        form.reset();
        const fileList = document.getElementById("file-list");
        if (fileList) fileList.innerHTML = "";

        if (typeof window.showToast === "function") {
          window.showToast(`Dokumen Trade Finance '${recordTitle}' telah dikirim. Pemrosesan AI Engine berjalan di latar belakang...`, "info", "Memproses Latar Belakang");
        }

        const singleFd = new FormData();
        singleFd.append("title", recordTitle);
        singleFd.append("company", recordCompany);
        singleFd.append("menu", recordMenu);
        singleFd.append("manual_supervisor", String(recordManualSupervisor));
        files.forEach((f) => singleFd.append("files", f));

        fetch("/api/tf/v1/create", { method: "POST", body: singleFd })
          .then((res) => res.json())
          .then((data) => {
            if (data.statusCode === "SUCCESSFUL") {
              if (typeof window.showToast === "function") window.showToast(`Dokumen '${recordTitle}' telah selesai diproses oleh sistem!`, "success", "Proses Selesai");
              debouncedInitializeDataTable();
            } else {
              if (typeof window.showToast === "function") window.showToast(data.message || "Gagal memproses dokumen Trade Finance", "error");
            }
          })
          .catch((err) => console.error(err));
      }
    });
}
