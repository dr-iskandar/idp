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
  fetch("/api/faas/bs/v1/list")
    .then((response) => {
      if (response.status === 403) {
        throw new Error("Access Forbidden");
      }
      return response.json();
    })
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        if (data.bankStatements && data.bankStatements.length > 0) {
          populateTable(data.bankStatements);
        } else {
          displayNoRecordsMessage();
        }
      } else {
        displayNoRecordsMessage();
        console.error("Failed to fetch bank statements:", data.message);
      }
    })
    .catch((error) => {
      if (error.message === "Access Forbidden") {
        lockPage("You do not have analyst access to view this page.");
      } else {
        displayNoRecordsMessage();
        console.error("Error fetching bank statements:", error);
      }
    });
}

function displayNoRecordsMessage() {
  if ($.fn.DataTable.isDataTable("#bs-table")) {
    try {
      $("#bs-table").DataTable().clear().destroy();
    } catch (e) {
      console.warn("DataTable destroy error:", e);
    }
  }

  const tableBody = document.getElementById("bs-table-body");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">No records found</td>
      </tr>
    `;
  }
}

function populateTable(bankStatements) {
  if (!bankStatements || bankStatements.length === 0) {
    displayNoRecordsMessage();
    return;
  }

  if ($.fn.DataTable.isDataTable("#bs-table")) {
    try {
      $("#bs-table").DataTable().clear().destroy();
    } catch (e) {
      console.warn("DataTable destroy error:", e);
    }
  }

  const tableBody = document.getElementById("bs-table-body");
  let tab = "";

  bankStatements.forEach((statement) => {
    let statusBadge = "";
    if (statement.status === "Finished") {
      statusBadge = `<span class="text-success small fw-semibold align-items-center d-inline-flex"><i class="fa-solid fa-circle-check me-1.5 fs-6"></i> Finished</span>`;
    } else if (statement.status === "Error") {
      statusBadge = `<span class="text-danger small fw-semibold align-items-center d-inline-flex"><i class="fa-solid fa-circle-xmark me-1.5 fs-6"></i> Error</span>`;
    } else {
      statusBadge = `<span class="text-warning small fw-semibold align-items-center d-inline-flex"><i class="fa-solid fa-spinner fa-spin me-1.5 fs-6"></i> Processing</span>`;
    }

    tab += `
      <tr>
        <td class="text-secondary small">${statement.createdAt}</td>
        <td class="font-monospace small">${statement.id}</td>
        <td class="fw-bold">${statement.title}</td>
        <td><span class="badge bg-light text-dark border px-2 py-1">${statement.totalPages}</span></td>
        <td>${statusBadge}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-primary view-btn px-2 py-1" data-id="${statement.id}" title="View Details">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger delete-btn px-2 py-1" data-id="${statement.id}" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = tab;

  $("#bs-table").DataTable({
    destroy: true,
    order: [[0, "desc"]], // Sort by the first column (Created At) in descending order
    columnDefs: [
      {
        targets: 0,
        type: "date",
      },
      {
        targets: -1,
        orderable: false, // Disable sorting on the last column (actions)
      },
    ],
    language: {
      sortDescending: "Sort Descending",
    },
  });

  // Add event listeners for view and delete buttons
  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const statementId = this.getAttribute("data-id");
      window.location.href = `/bank-statement/details/${statementId}`;
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const statementId = this.getAttribute("data-id");
      showConfirmModal({
        title: "Hapus Bank Statement",
        message: "Apakah Anda yakin ingin menghapus data rekening koran ini secara permanen?",
        confirmText: "Ya, Hapus",
        onConfirm: () => deleteRecord(statementId),
      });
    });
  });
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
    font-size: 20px;
    color: #721c24;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    padding: 24px 32px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  `;
  lockMessage.textContent = message;

  document.body.appendChild(lockMessage);
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
        "list-group-item d-flex justify-content-between align-items-center rounded-3 mb-1 border-0 bg-light";
      listItem.textContent = file.name;

      const removeButton = document.createElement("button");
      removeButton.className = "btn btn-danger btn-sm py-0 px-2";
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
  const recordNameInput = document.getElementById("record-name");
  const btnSingle = document.getElementById("btn-single-mode");
  const btnBulk = document.getElementById("btn-bulk-mode");
  const recordNameContainer = document.getElementById("record-name-container");

  if (btnSingle && btnBulk) {
    btnSingle.addEventListener("click", function () {
      isBulkMode = false;
      btnSingle.classList.add("btn-primary", "active");
      btnSingle.classList.remove("btn-outline-secondary");
      btnBulk.classList.remove("btn-primary", "active");
      btnBulk.classList.add("btn-outline-secondary");
      if (recordNameContainer) recordNameContainer.style.display = "block";
    });

    btnBulk.addEventListener("click", function () {
      isBulkMode = true;
      btnBulk.classList.add("btn-primary", "active");
      btnBulk.classList.remove("btn-outline-secondary");
      btnSingle.classList.remove("btn-primary", "active");
      btnSingle.classList.add("btn-outline-secondary");
      if (recordNameContainer) recordNameContainer.style.display = "none";
    });
  }

  document
    .getElementById("submit-button")
    .addEventListener("click", async function () {
      const fileInput = document.getElementById("file-input");
      const files = Array.from(fileInput.files);

      if (files.length === 0) {
        showToast("Silakan pilih minimal satu berkas untuk diunggah.", "warning");
        return;
      }

      let publicKeyPEME = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtSTO4LH+HGNfCf1YhUyB
jYvDyaC1fOmPBQ0VhKydrlnJOb+6V9zWFCZbvxxzJpqI6Jnehi7w6Ynh5tpbM8xP
nAOnbeUInfJXwckX6Ua9SdWUvPgGtpVKsJKr7drNX/6Dx2uJEt2v/9WWsS3Y3kuq
fD4jpG4xOSy35SajpccMbHZBmdlYZ1lp3k5pU47B4l9wsipFzswOV8IlWvft74KM
axTDdpOett331QTrqAGUl92UrWnyrIe9Rji4HOw3fecziriDZqaN0xWwDX9XgMsu
PnqnKGyWGUWmSJl027FoY1OscMremhiODLBsbvLIgSwSPn20aEznXcnC6AgoT40t
AwIDAQAB
-----END PUBLIC KEY-----
`;
      const publicKey = await importPublicKey(publicKeyPEME);

      // Hide modal immediately for async non-blocking UX
      const modalElement = document.getElementById("staticBackdrop");
      if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();
      }

      if (isBulkMode) {
        showToast(`Bulk upload dimulai: ${files.length} dokumen sedang diproses di latar belakang...`, "info", "Bulk Processing");
        form.reset();
        document.getElementById("file-list").innerHTML = "";

        files.forEach(async (file) => {
          try {
            const rawTitle = file.name.replace(/\.[^/.]+$/, "");
            const encryptedTitle = await encryptData(publicKey, rawTitle);
            const encryptedTitleBase64 = ab2str(encryptedTitle);

            const singleFd = new FormData();
            singleFd.append("title", encryptedTitleBase64);
            singleFd.append("files", file);

            fetch("/api/faas/bs/v1/create", { method: "POST", body: singleFd })
              .then((res) => res.json())
              .then((data) => {
                if (data.statusCode === "SUCCESSFUL") {
                  showToast(`Dokumen '${rawTitle}' selesai diproses oleh sistem!`, "success", "Proses Selesai");
                  debouncedInitializeDataTable();
                } else {
                  showToast(`Gagal memproses '${rawTitle}': ${data.message}`, "error");
                }
              })
              .catch((err) => console.error(err));
          } catch (err) {
            console.error("Bulk upload error:", err);
          }
        });
      } else {
        const recordName = recordNameInput.value.trim();
        if (!recordName) {
          showToast("Nama Rekaman harus diisi.", "warning");
          return;
        }

        form.reset();
        document.getElementById("file-list").innerHTML = "";
        showToast(`Dokumen '${recordName}' telah dikirim. Pemrosesan AI Engine berjalan di latar belakang...`, "info", "Memproses Latar Belakang");

        try {
          const encryptedTitle = await encryptData(publicKey, recordName);
          const encryptedTitleBase64 = ab2str(encryptedTitle);
          const singleFd = new FormData();
          singleFd.append("title", encryptedTitleBase64);
          files.forEach((f) => singleFd.append("files", f));

          fetch("/api/faas/bs/v1/create", { method: "POST", body: singleFd })
            .then((res) => res.json())
            .then((data) => {
              if (data.statusCode === "SUCCESSFUL") {
                showToast(`Dokumen '${recordName}' telah selesai diproses oleh sistem!`, "success", "Proses Selesai");
                debouncedInitializeDataTable();
              } else {
                showToast(data.message || "Failed to process request", "error");
              }
            })
            .catch((err) => console.error(err));
        } catch (err) {
          console.error(err);
        }
      }
    });
}

function deleteRecord(statementId) {
  fetch(`/api/faas/bs/v1/delete?bsId=${statementId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        if (typeof window.showToast === "function") window.showToast("Rekening koran berhasil dihapus.", "success");
        debouncedInitializeDataTable();
      } else {
        if (typeof window.showToast === "function") window.showToast(data.message || "Gagal menghapus rekaman", "error");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

async function importPublicKey(pemKey) {
  const binaryDer = str2ab(pemKey);
  return await crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

// Helper function to convert PEM to ArrayBuffer
function str2ab(pem) {
  const lines = pem.split("\n");
  let encoded = "";
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].trim().length > 0 &&
      lines[i].indexOf("-BEGIN PUBLIC KEY-") < 0 &&
      lines[i].indexOf("-END PUBLIC KEY-") < 0
    ) {
      encoded += lines[i].trim();
    }
  }
  const binaryString = window.atob(encoded);
  const binaryLen = binaryString.length;
  const bytes = new Uint8Array(binaryLen);
  for (let i = 0; i < binaryLen; i++) {
    const ascii = binaryString.charCodeAt(i);
    bytes[i] = ascii;
  }
  return bytes.buffer;
}

// Function to encrypt data
async function encryptData(publicKey, data) {
  const encoded = new TextEncoder().encode(data);
  return await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    encoded
  );
}

// Convert ArrayBuffer to Base64 string for transmission
function ab2str(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}
