document.addEventListener("DOMContentLoaded", function () {
  setupModeSwitch();
  setupFileInputs();
  setupDragAndDrop();
  setupFormSubmit();
  setupExcelFormSubmit();
});

let currentMode = "doc2doc";

function setupModeSwitch() {
  const btnDoc2Doc = document.getElementById("btn-mode-doc2doc");
  const btnExcel2Doc = document.getElementById("btn-mode-excel2doc");
  const formDoc2Doc = document.getElementById("playground-doc2doc-form");
  const formExcel2Doc = document.getElementById("playground-excel2doc-form");
  const resultsSection = document.getElementById("results-section");

  if (btnDoc2Doc && btnExcel2Doc) {
    btnDoc2Doc.addEventListener("click", function () {
      currentMode = "doc2doc";
      btnDoc2Doc.classList.add("btn-primary", "active");
      btnDoc2Doc.classList.remove("btn-outline-secondary");
      btnExcel2Doc.classList.remove("btn-primary", "active");
      btnExcel2Doc.classList.add("btn-outline-secondary");

      formDoc2Doc.classList.remove("d-none");
      formExcel2Doc.classList.add("d-none");
      if (resultsSection) resultsSection.classList.add("d-none");
    });

    btnExcel2Doc.addEventListener("click", function () {
      currentMode = "excel2doc";
      btnExcel2Doc.classList.add("btn-primary", "active");
      btnExcel2Doc.classList.remove("btn-outline-secondary");
      btnDoc2Doc.classList.remove("btn-primary", "active");
      btnDoc2Doc.classList.add("btn-outline-secondary");

      formExcel2Doc.classList.remove("d-none");
      formDoc2Doc.classList.add("d-none");
      if (resultsSection) resultsSection.classList.add("d-none");
    });
  }
}

function setupFileInputs() {
  // Doc A & Doc B
  const fileAInput = document.getElementById("file-a-input");
  const fileBInput = document.getElementById("file-b-input");
  const containerA = document.getElementById("file-a-name-container");
  const containerB = document.getElementById("file-b-name-container");
  const dropzoneA = document.getElementById("dropzone-a");
  const dropzoneB = document.getElementById("dropzone-b");

  if (fileAInput) {
    fileAInput.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        containerA.querySelector("span span").textContent = this.files[0].name;
        containerA.classList.remove("d-none");
        dropzoneA.classList.add("has-file");
      } else {
        containerA.classList.add("d-none");
        dropzoneA.classList.remove("has-file");
      }
    });
  }

  if (fileBInput) {
    fileBInput.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        containerB.querySelector("span span").textContent = this.files[0].name;
        containerB.classList.remove("d-none");
        dropzoneB.classList.add("has-file");
      } else {
        containerB.classList.add("d-none");
        dropzoneB.classList.remove("has-file");
      }
    });
  }

  // Excel File
  const excelInput = document.getElementById("excel-file-input");
  const containerExcel = document.getElementById("excel-file-name-container");
  const dropzoneExcel = document.getElementById("dropzone-excel");

  if (excelInput) {
    excelInput.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        containerExcel.querySelector("span span").textContent = this.files[0].name;
        containerExcel.classList.remove("d-none");
        dropzoneExcel.classList.add("has-file");
      } else {
        containerExcel.classList.add("d-none");
        dropzoneExcel.classList.remove("has-file");
      }
    });
  }

  // Multi Doc Files for Excel Mode
  const docImagesInput = document.getElementById("doc-images-input");
  const containerImages = document.getElementById("doc-images-name-container");
  const docImagesList = document.getElementById("doc-images-list");
  const dropzoneImages = document.getElementById("dropzone-doc-images");

  if (docImagesInput) {
    docImagesInput.addEventListener("change", function () {
      if (this.files && this.files.length > 0) {
        let listHtml = "";
        Array.from(this.files).forEach((file) => {
          listHtml += `<span class="file-chip"><i class="fa-solid fa-file-image me-1"></i> ${file.name}</span>`;
        });
        docImagesList.innerHTML = listHtml;
        containerImages.classList.remove("d-none");
        dropzoneImages.classList.add("has-file");
      } else {
        docImagesList.innerHTML = "";
        containerImages.classList.add("d-none");
        dropzoneImages.classList.remove("has-file");
      }
    });
  }
}

function setupDragAndDrop() {
  const dropzones = [
    { id: "dropzone-a", inputId: "file-a-input" },
    { id: "dropzone-b", inputId: "file-b-input" },
    { id: "dropzone-excel", inputId: "excel-file-input" },
    { id: "dropzone-doc-images", inputId: "doc-images-input" }
  ];

  dropzones.forEach(({ id, inputId }) => {
    const dz = document.getElementById(id);
    if (!dz) return;

    ["dragenter", "dragover"].forEach((eventName) => {
      dz.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dz.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove("drag-over");
      });
    });

    dz.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const fileInput = document.getElementById(inputId);
        fileInput.files = files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });
  });
}

function setupFormSubmit() {
  const form = document.getElementById("playground-doc2doc-form");
  const submitBtn = document.getElementById("btn-submit-reconcile");
  if (!form || !submitBtn) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const fileA = document.getElementById("file-a-input").files[0];
    const fileB = document.getElementById("file-b-input").files[0];

    if (!fileA && !fileB) {
      if (typeof window.showToast === "function") {
        window.showToast("Silakan pilih minimal satu berkas dokumen untuk diunggah.", "warning", "Peringatan");
      }
      return;
    }

    const formData = new FormData(form);

    if (typeof window.showToast === "function") {
      window.showToast(
        "Dokumen telah dikirim. Pemrosesan AI Engine berjalan di latar belakang...",
        "info",
        "Memproses Latar Belakang"
      );
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Memproses AI Engine...`;

    fetch("/api/playground/v1/doc-to-doc/compare", {
      method: "POST",
      body: formData
    })
      .then(async (res) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        const text = await res.text();
        throw new Error(`Server status ${res.status}: ${text}`);
      })
      .then((data) => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate me-2"></i> Jalankan Rekonsiliasi Dokumen`;

        if (data.status_code === "SUCCESSFUL" || data.overall_match_score !== undefined) {
          renderReconciliationResults(data, "doc2doc");

          if (typeof window.showToast === "function") {
            window.showToast(
              `Rekonsiliasi dokumen selesai diproses oleh sistem! (Match Score: ${data.overall_match_score || 0}%)`,
              "success",
              "Proses Selesai"
            );
          }
        } else {
          if (typeof window.showToast === "function") {
            window.showToast(data.message || "Gagal memproses rekonsiliasi dokumen.", "error", "Gagal");
          }
        }
      })
      .catch((err) => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate me-2"></i> Jalankan Rekonsiliasi Dokumen`;
        console.error("Reconcile Error:", err);
        if (typeof window.showToast === "function") {
          window.showToast("Terjadi kesalahan server saat memproses rekonsiliasi: " + err.message, "error", "Error");
        }
      });
  });
}

function setupExcelFormSubmit() {
  const form = document.getElementById("playground-excel2doc-form");
  const submitBtn = document.getElementById("btn-submit-excel-reconcile");
  if (!form || !submitBtn) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const excelFile = document.getElementById("excel-file-input").files[0];
    if (!excelFile) {
      if (typeof window.showToast === "function") {
        window.showToast("Silakan unggah berkas Excel / CSV terlebih dahulu.", "warning", "Peringatan");
      }
      return;
    }

    const formData = new FormData(form);

    if (typeof window.showToast === "function") {
      window.showToast(
        "Data Excel & Dokumen telah dikirim. Analisis AI Engine sedang berlangsung...",
        "info",
        "Memproses Latar Belakang"
      );
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Memproses AI Engine...`;

    fetch("/api/playground/v1/excel-to-doc/compare", {
      method: "POST",
      body: formData
    })
      .then(async (res) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        const text = await res.text();
        throw new Error(`Server status ${res.status}: ${text}`);
      })
      .then((data) => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate me-2"></i> Jalankan Rekonsiliasi Excel vs Dokumen`;

        if (data.status_code === "SUCCESSFUL" || data.overall_match_score !== undefined) {
          renderReconciliationResults(data, "excel2doc");

          if (typeof window.showToast === "function") {
            window.showToast(
              `Rekonsiliasi Excel vs Dokumen selesai! (Match Score: ${data.overall_match_score || 0}%)`,
              "success",
              "Proses Selesai"
            );
          }
        } else {
          if (typeof window.showToast === "function") {
            window.showToast(data.message || "Gagal memproses rekonsiliasi Excel.", "error", "Gagal");
          }
        }
      })
      .catch((err) => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate me-2"></i> Jalankan Rekonsiliasi Excel vs Dokumen`;
        console.error("Excel Reconcile Error:", err);
        if (typeof window.showToast === "function") {
          window.showToast("Terjadi kesalahan server saat memproses rekonsiliasi Excel: " + err.message, "error", "Error");
        }
      });
  });
}

function renderReconciliationResults(data, mode = "doc2doc") {
  const resultsSection = document.getElementById("results-section");
  const scoreBadge = document.getElementById("reconcile-score-badge");
  const statusBadge = document.getElementById("reconcile-status-badge");
  const aiSummaryText = document.getElementById("ai-summary-text");
  const matrixTbody = document.getElementById("reconcile-matrix-tbody");
  const headerTr = document.getElementById("matrix-table-header");

  resultsSection.classList.remove("d-none");

  // Update Header based on mode
  if (mode === "excel2doc" || data.mode === "excel_to_doc") {
    headerTr.innerHTML = `
      <th>Field / Parameter</th>
      <th>Nilai Data Excel (Expected)</th>
      <th>Nilai Dokumen Fisik (Actual)</th>
      <th>Status Match</th>
      <th>Skor Similarity</th>
      <th>Catatan Audit</th>
    `;
  } else {
    headerTr.innerHTML = `
      <th>Item Perbandingan</th>
      <th>Nilai Dokumen A</th>
      <th>Nilai Dokumen B</th>
      <th>Status Match</th>
      <th>Skor Similarity</th>
      <th>Catatan Audit</th>
    `;
  }

  const score = data.overall_match_score || 0;
  scoreBadge.textContent = `Match Score: ${score}%`;

  const status = data.reconciliation_status || "WARNING";
  if (status === "PASSED") {
    statusBadge.className = "badge bg-success px-3 py-2 fs-6 rounded-pill";
    statusBadge.textContent = "PASSED";
  } else if (status === "WARNING") {
    statusBadge.className = "badge bg-warning text-dark px-3 py-2 fs-6 rounded-pill";
    statusBadge.textContent = "WARNING";
  } else {
    statusBadge.className = "badge bg-danger px-3 py-2 fs-6 rounded-pill";
    statusBadge.textContent = "FAILED";
  }

  aiSummaryText.textContent = data.ai_summary || "Pemeriksaan rekonsiliasi selesai diproses.";

  let matrixHtml = "";
  if (data.comparison_matrix && Array.isArray(data.comparison_matrix)) {
    data.comparison_matrix.forEach((item) => {
      let badgeHtml = "";
      let scoreColor = "text-success";

      const matchType = item.match_type || "MISMATCH";

      if (matchType === "MATCH") {
        badgeHtml = `<span class="badge-match">MATCH</span>`;
        scoreColor = "text-success";
      } else if (matchType === "FUZZY_MATCH" || matchType === "PARTIAL_MATCH") {
        badgeHtml = `<span class="badge-fuzzy">${matchType}</span>`;
        scoreColor = "text-warning";
      } else {
        badgeHtml = `<span class="badge-mismatch">MISMATCH</span>`;
        scoreColor = "text-danger";
      }

      const valA = item.excel_value !== undefined ? item.excel_value : (item.value_a || "-");
      const valB = item.doc_value !== undefined ? item.doc_value : (item.value_b || "-");
      const fieldLabel = item.label || item.field || item.field_a || "Item";

      matrixHtml += `
        <tr>
          <td class="fw-semibold">${fieldLabel}</td>
          <td><code>${valA}</code></td>
          <td><code>${valB}</code></td>
          <td>${badgeHtml}</td>
          <td class="fw-bold ${scoreColor}">${item.score || 0}%</td>
          <td class="${matchType === 'MISMATCH' ? 'text-danger fw-semibold' : 'text-secondary'} small">${item.note || ''}</td>
        </tr>
      `;
    });
  }

  matrixTbody.innerHTML = matrixHtml;
  resultsSection.scrollIntoView({ behavior: "smooth" });
}
