// Global Apple-style Toast Notification System
window.showToast = function (message, type = "info", title = "") {
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.className = "toast-container-apple";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast-apple toast-apple-${type}`;

  let iconHtml = "";
  if (type === "success") {
    iconHtml = '<div class="toast-icon toast-icon-success"><i class="fa-solid fa-circle-check"></i></div>';
    if (!title) title = "Berhasil";
  } else if (type === "error" || type === "danger") {
    iconHtml = '<div class="toast-icon toast-icon-error"><i class="fa-solid fa-circle-xmark"></i></div>';
    if (!title) title = "Gagal";
  } else if (type === "warning") {
    iconHtml = '<div class="toast-icon toast-icon-warning"><i class="fa-solid fa-triangle-exclamation"></i></div>';
    if (!title) title = "Peringatan";
  } else {
    iconHtml = '<div class="toast-icon toast-icon-info"><i class="fa-solid fa-circle-info"></i></div>';
    if (!title) title = "Informasi";
  }

  toast.innerHTML = `
    ${iconHtml}
    <div class="toast-body-content">
      <div class="toast-title-text">${title}</div>
      <div class="toast-message-text">${message}</div>
    </div>
    <button type="button" class="toast-close-btn" onclick="this.parentElement.remove()">&times;</button>
  `;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 400);
  }, 4200);
};

// Override browser alert with Toast
window.alert = function (msg, overrideType) {
  let toastType = "info";
  if (typeof overrideType === "string") {
    toastType = overrideType;
  } else if (typeof msg === "string") {
    const lower = msg.toLowerCase();
    if (lower.includes("success") || lower.includes("berhasil") || lower.includes("selesai")) {
      toastType = "success";
    } else if (
      lower.includes("error") ||
      lower.includes("failed") ||
      lower.includes("gagal") ||
      lower.includes("invalid") ||
      lower.includes("required") ||
      lower.includes("salah") ||
      lower.includes("exceeded")
    ) {
      toastType = "error";
    } else if (lower.includes("warning") || lower.includes("peringatan")) {
      toastType = "warning";
    }
  }
  window.showToast(msg, toastType);
};

// Global Apple-style Confirmation Popup Modal
window.showConfirmModal = function ({
  title = "Konfirmasi Hapus",
  message = "Apakah Anda yakin ingin menghapus data ini?",
  confirmText = "Ya, Hapus",
  cancelText = "Batal",
  confirmBtnClass = "btn-danger",
  onConfirm = () => {}
} = {}) {
  let modalContainer = document.getElementById("apple-confirm-modal");
  if (modalContainer) {
    modalContainer.remove();
  }

  modalContainer = document.createElement("div");
  modalContainer.id = "apple-confirm-modal";
  modalContainer.className = "modal fade show";
  modalContainer.style.cssText = "display: block; background: rgba(0,0,0,0.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100000;";

  modalContainer.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" style="max-width: 420px;">
      <div class="modal-content shadow-lg border-0" style="border-radius: 24px; padding: 1.25rem; background: rgba(255,255,255,0.95); backdrop-filter: blur(25px);">
        <div class="modal-body text-center pt-3 px-3 pb-2">
          <div class="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-danger bg-opacity-10 text-danger" style="width: 56px; height: 56px; font-size: 1.5rem;">
            <i class="fa-solid fa-trash-can"></i>
          </div>
          <h5 class="fw-bold mb-2 text-dark" style="font-size: 1.2rem;">${title}</h5>
          <p class="text-secondary small mb-4" style="line-height: 1.45;">${message}</p>
          <div class="d-flex gap-2 justify-content-center">
            <button type="button" class="btn btn-secondary flex-grow-1 py-2 px-3 border-0 bg-light text-dark fw-semibold" style="border-radius: 12px;" id="apple-confirm-cancel-btn">${cancelText}</button>
            <button type="button" class="btn ${confirmBtnClass} flex-grow-1 py-2 px-3 fw-semibold shadow-sm" style="border-radius: 12px;" id="apple-confirm-ok-btn">${confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  const cancelBtn = modalContainer.querySelector("#apple-confirm-cancel-btn");
  const okBtn = modalContainer.querySelector("#apple-confirm-ok-btn");

  const closeModal = () => {
    modalContainer.classList.remove("show");
    modalContainer.remove();
  };

  cancelBtn.onclick = closeModal;
  okBtn.onclick = () => {
    closeModal();
    if (typeof onConfirm === "function") {
      onConfirm();
    }
  };
};

function setupNavigation() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll("#navigation .nav-link");

  fetch("/api/user/v1/detail", {
    method: "GET",
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status_code === "SUCCESSFUL") {
        const userRole = data.user_details.role;
        const pgNav = document.getElementById("nav-playground");
        if (pgNav) pgNav.style.display = "block";

        if (userRole === "analyst") {
          document.getElementById("nav-home").style.display = "none";
          document.getElementById("nav-bank-statement").style.display = "block";
          document.getElementById("nav-financial-statement").style.display =
            "block";
          document.getElementById("nav-trade-finance").style.display = "block";
        } else if (userRole === "operational") {
          document.getElementById("nav-home").style.display = "block";
          document.getElementById("nav-bank-statement").style.display = "none";
          document.getElementById("nav-financial-statement").style.display =
            "none";
          document.getElementById("nav-trade-finance").style.display = "none";
        }

        navLinks.forEach((link) => {
          if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
          } else {
            link.classList.remove("active");
          }
        });
      } else {
        console.error("Failed to fetch user details:", data.message);
      }
    })
    .catch((error) => console.error("Error:", error));
}

document.addEventListener("DOMContentLoaded", setupNavigation);
