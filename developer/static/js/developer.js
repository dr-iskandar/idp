// developer.js - Developer Portal & Metered Billing Interactive Logic

document.addEventListener("DOMContentLoaded", function () {
  loadSummary();
  loadKeys();
  loadLogs();
  setupCodeSnippets();
  setupCreateKeyHandler();
});

let currentLang = "curl";
let currentEndpoint = "reconcile";

function loadSummary() {
  fetch("/developer/v1/summary")
    .then((res) => res.json())
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        document.getElementById("metric-hit-balance").innerHTML = `${data.hitBalance.toLocaleString()} <span class="fs-6 text-secondary fw-normal">/ ${data.hitLimit.toLocaleString()}</span>`;
        document.getElementById("metric-price-rate").innerHTML = `Rp ${data.pricePerHit} <span class="fs-6 text-secondary fw-normal">/ hit</span>`;
        document.getElementById("metric-total-exec").innerHTML = `${data.totalExecutions} <span class="fs-6 text-secondary fw-normal">dokumen</span>`;
        document.getElementById("metric-success-rate").innerText = data.successRate;
      }
    })
    .catch((err) => console.error("Error loading summary:", err));
}

function loadKeys() {
  fetch("/developer/v1/keys/list")
    .then((res) => res.json())
    .then((data) => {
      const tbody = document.getElementById("keys-table-body");
      if (!tbody) return;

      if (data.statusCode === "SUCCESSFUL" && data.keys && data.keys.length > 0) {
        let rows = "";
        data.keys.forEach((key) => {
          const statusBadge = key.status === "Active"
            ? `<span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill"><i class="fa-solid fa-circle-check me-1"></i> Active</span>`
            : `<span class="badge bg-secondary-subtle text-secondary border px-2.5 py-1 rounded-pill"><i class="fa-solid fa-ban me-1"></i> Revoked</span>`;

          const revokeBtn = key.status === "Active"
            ? `<button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1" onclick="revokeKey('${key.id}', '${key.name}')"><i class="fa-solid fa-power-off me-1"></i> Revoke</button>`
            : `<span class="text-muted small">N/A</span>`;

          rows += `
            <tr>
              <td class="fw-bold text-dark">${key.name}</td>
              <td><span class="key-badge-prefix">${key.keyPrefix}</span></td>
              <td>${statusBadge}</td>
              <td class="text-secondary small">${key.lastUsedAt}</td>
              <td class="text-center">${revokeBtn}</td>
            </tr>
          `;
        });
        tbody.innerHTML = rows;
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted py-4">Belum ada API Key. Klik tombol <strong>Generate API Key Baru</strong> di atas untuk membuat.</td>
          </tr>
        `;
      }
    })
    .catch((err) => console.error("Error loading keys:", err));
}

function revokeKey(keyId, keyName) {
  if (typeof window.showConfirmModal === "function") {
    window.showConfirmModal({
      title: "Revoke API Key",
      message: `Apakah Anda yakin ingin menonaktifkan API Key '${keyName}'? Akses sistem yang menggunakan key ini akan dihentikan.`,
      confirmText: "Ya, Revoke Key",
      onConfirm: () => executeRevokeKey(keyId)
    });
  } else if (confirm(`Revoke API Key '${keyName}'?`)) {
    executeRevokeKey(keyId);
  }
}

function executeRevokeKey(keyId) {
  fetch("/developer/v1/keys/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyId: keyId })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        if (typeof window.showToast === "function") window.showToast("API Key berhasil dinonaktifkan.", "success");
        loadKeys();
      } else {
        if (typeof window.showToast === "function") window.showToast(data.message || "Gagal menonaktifkan API Key", "error");
      }
    })
    .catch((err) => console.error(err));
}

function setupCreateKeyHandler() {
  const btn = document.getElementById("btn-submit-create-key");
  const form = document.getElementById("create-key-form");

  if (btn) {
    btn.addEventListener("click", function () {
      const nameInput = document.getElementById("key-name-input");
      const keyName = nameInput.value.trim();
      if (!keyName) {
        if (typeof window.showToast === "function") window.showToast("Harap isi nama API Key.", "warning");
        return;
      }

      fetch("/developer/v1/keys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.statusCode === "SUCCESSFUL") {
            const displayBox = document.getElementById("secret-key-display-box");
            const keyInput = document.getElementById("generated-secret-key-input");

            if (displayBox && keyInput) {
              keyInput.value = data.apiKey;
              displayBox.classList.remove("d-none");
            }
            if (typeof window.showToast === "function") window.showToast("API Key berhasil dibuat!", "success");
            loadKeys();
          } else {
            if (typeof window.showToast === "function") window.showToast(data.message || "Gagal membuat API Key", "error");
          }
        })
        .catch((err) => console.error(err));
    });
  }
}

function copyGeneratedKey() {
  const keyInput = document.getElementById("generated-secret-key-input");
  if (keyInput && keyInput.value) {
    navigator.clipboard.writeText(keyInput.value).then(() => {
      if (typeof window.showToast === "function") window.showToast("API Key berhasil disalin ke clipboard!", "info");
    });
  }
}

function loadLogs() {
  fetch("/developer/v1/logs/list")
    .then((res) => res.json())
    .then((data) => {
      const tbody = document.getElementById("logs-table-body");
      if (!tbody) return;

      if (data.statusCode === "SUCCESSFUL" && data.logs && data.logs.length > 0) {
        let rows = "";
        data.logs.forEach((log) => {
          const statusBadge = log.statusCode === 200 || log.statusCode === 201
            ? `<span class="badge bg-success-subtle text-success px-2 py-1">200 OK</span>`
            : `<span class="badge bg-danger-subtle text-danger px-2 py-1">${log.statusCode}</span>`;

          rows += `
            <tr>
              <td class="text-secondary small">${log.createdAt}</td>
              <td class="fw-semibold text-dark font-monospace small">${log.endpoint}</td>
              <td><span class="badge bg-light text-dark border px-2 py-1 font-monospace">${log.method}</span></td>
              <td>${statusBadge}</td>
              <td class="text-secondary small font-monospace">${log.latencyMs} ms</td>
              <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill">-${log.hitsCount} Hit</span></td>
            </tr>
          `;
        });
        tbody.innerHTML = rows;
      } else {
        // Fallback sample audit logs for demonstration
        tbody.innerHTML = `
          <tr>
            <td class="text-secondary small">Just Now</td>
            <td class="fw-semibold text-dark font-monospace small">/api/playground/v1/doc-to-doc/compare</td>
            <td><span class="badge bg-light text-dark border px-2 py-1 font-monospace">POST</span></td>
            <td><span class="badge bg-success-subtle text-success px-2 py-1">200 OK</span></td>
            <td class="text-secondary small font-monospace">1,240 ms</td>
            <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill">-1 Hit</span></td>
          </tr>
          <tr>
            <td class="text-secondary small">10 mins ago</td>
            <td class="fw-semibold text-dark font-monospace small">/api/faas/bs/v1/create</td>
            <td><span class="badge bg-light text-dark border px-2 py-1 font-monospace">POST</span></td>
            <td><span class="badge bg-success-subtle text-success px-2 py-1">200 OK</span></td>
            <td class="text-secondary small font-monospace">850 ms</td>
            <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill">-1 Hit</span></td>
          </tr>
          <tr>
            <td class="text-secondary small">25 mins ago</td>
            <td class="fw-semibold text-dark font-monospace small">/api/tf/v1/create</td>
            <td><span class="badge bg-light text-dark border px-2 py-1 font-monospace">POST</span></td>
            <td><span class="badge bg-success-subtle text-success px-2 py-1">200 OK</span></td>
            <td class="text-secondary small font-monospace">1,110 ms</td>
            <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill">-1 Hit</span></td>
          </tr>
        `;
      }
    })
    .catch((err) => console.error("Error loading logs:", err));
}

function setupCodeSnippets() {
  const langBtns = document.querySelectorAll(".code-lang-btn");
  const endpointSelector = document.getElementById("endpoint-selector");

  langBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      langBtns.forEach((b) => {
        b.classList.remove("btn-dark", "active");
        b.classList.add("btn-outline-secondary");
      });
      this.classList.add("btn-dark", "active");
      this.classList.remove("btn-outline-secondary");
      currentLang = this.getAttribute("data-lang");
      updateSnippet();
    });
  });

  if (endpointSelector) {
    endpointSelector.addEventListener("change", function () {
      currentEndpoint = this.value;
      updateSnippet();
    });
  }

  updateSnippet();
}

function updateSnippet() {
  const display = document.getElementById("snippet-display-area");
  if (!display) return;

  const baseUrl = window.location.origin;

  let urlMap = {
    reconcile: `${baseUrl}/api/playground/v1/doc-to-doc/compare`,
    bank_statement: `${baseUrl}/api/faas/bs/v1/create`,
    financial_statement: `${baseUrl}/api/faas/fs/v1/create`,
    trade_finance: `${baseUrl}/api/tf/v1/create`
  };

  let targetUrl = urlMap[currentEndpoint] || urlMap.reconcile;

  let snippet = "";

  if (currentLang === "curl") {
    snippet = `curl -X POST "${targetUrl}" \\
  -H "Authorization: Bearer doc_live_YOUR_API_KEY" \\
  -F "file_a=@doc1.pdf" \\
  -F "file_b=@doc2.pdf"`;
  } else if (currentLang === "python") {
    snippet = `import requests

url = "${targetUrl}"
headers = {
    "Authorization": "Bearer doc_live_YOUR_API_KEY"
}
files = {
    "file_a": open("doc1.pdf", "rb"),
    "file_b": open("doc2.pdf", "rb")
}

response = requests.post(url, headers=headers, files=files)
print(response.json())`;
  } else if (currentLang === "nodejs") {
    snippet = `const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

const form = new FormData();
form.append('file_a', fs.createReadStream('doc1.pdf'));
form.append('file_b', fs.createReadStream('doc2.pdf'));

axios.post('${targetUrl}', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer doc_live_YOUR_API_KEY'
  }
}).then(res => console.log(res.data));`;
  }

  display.innerHTML = `<code>${escapeHtml(snippet)}</code>`;
}

function copySnippet() {
  const display = document.getElementById("snippet-display-area");
  if (display) {
    navigator.clipboard.writeText(display.innerText).then(() => {
      if (typeof window.showToast === "function") window.showToast("Snippet kode berhasil disalin!", "info");
    });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
