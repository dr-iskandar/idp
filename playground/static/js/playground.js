document.addEventListener("DOMContentLoaded", function () {
  setupFileInputs();
  setupDragAndDrop();
  setupFormSubmit();
});

function setupFileInputs() {
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
}

function setupDragAndDrop() {
  ["dropzone-a", "dropzone-b"].forEach((id) => {
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
        const inputId = id === "dropzone-a" ? "file-a-input" : "file-b-input";
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

    // Non-blocking Toast notification without OpenAI wording
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
          renderReconciliationResults(data);

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

function renderReconciliationResults(data) {
  const resultsSection = document.getElementById("results-section");
  const scoreBadge = document.getElementById("reconcile-score-badge");
  const statusBadge = document.getElementById("reconcile-status-badge");
  const aiSummaryText = document.getElementById("ai-summary-text");
  const matrixTbody = document.getElementById("reconcile-matrix-tbody");

  resultsSection.classList.remove("d-none");

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

  aiSummaryText.textContent = data.ai_summary || "Pemeriksaan rekonsiliasi dokumen selesai diproses.";

  let matrixHtml = "";
  if (data.comparison_matrix && Array.isArray(data.comparison_matrix)) {
    data.comparison_matrix.forEach((item) => {
      let badgeHtml = "";
      let scoreColor = "text-success";

      if (item.match_type === "MATCH") {
        badgeHtml = `<span class="badge-match">MATCH</span>`;
        scoreColor = "text-success";
      } else if (item.match_type === "FUZZY_MATCH" || item.match_type === "PARTIAL_MATCH") {
        badgeHtml = `<span class="badge-fuzzy">${item.match_type}</span>`;
        scoreColor = "text-warning";
      } else {
        badgeHtml = `<span class="badge-mismatch">MISMATCH</span>`;
        scoreColor = "text-danger";
      }

      matrixHtml += `
        <tr>
          <td class="fw-semibold">${item.label || item.field_a}</td>
          <td><code>${item.value_a || '-'}</code></td>
          <td><code>${item.value_b || '-'}</code></td>
          <td>${badgeHtml}</td>
          <td class="fw-bold ${scoreColor}">${item.score || 0}%</td>
          <td class="${item.match_type === 'MISMATCH' ? 'text-danger fw-semibold' : 'text-secondary'} small">${item.note || ''}</td>
        </tr>
      `;
    });
  }

  matrixTbody.innerHTML = matrixHtml;
  resultsSection.scrollIntoView({ behavior: "smooth" });
}
