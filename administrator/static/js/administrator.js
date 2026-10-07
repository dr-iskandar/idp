document.addEventListener("DOMContentLoaded", function () {
  initializeDataTable();
  setupCreateCompanyForm();
});

function initializeDataTable() {
  fetch("/api/administrator/v1/companies")
    .then((response) => {
      if (response.status === 403) {
        throw new Error("Access Forbidden");
      }
      return response.json();
    })
    .then((data) => {
      if (data.status_code === "SUCCESSFUL") {
        populateTable(data.companies);
      } else {
        console.error("Failed to fetch company records:", data.message);
      }
    })
    .catch((error) => {
      if (error.message === "Access Forbidden") {
        lockPage("You do not have analyst access to view this page.");
      } else {
        console.error("Error fetching financial statements:", error);
      }
    });
}

function populateTable(companies) {
  const tableBody = document.getElementById("tf-table-body");
  let tableContent = "";

  companies.forEach((company) => {
    const percentageValue = parseFloat(company.percentage);
    const percentageClass = getPercentageClass(percentageValue);
    tableContent += `
      <tr>
        <td class="text-center">${company.createdAt}</td>
        <td class="text-center">${company.id}</td>
        <td class="text-center">${company.name}</td>
        <td class="text-center">${company.limit}</td>
        <td class="text-center">${company.usage}</td>
        <td class="text-center">
          <div class="progress ">
            <div class="progress-bar ${percentageClass}" role="progressbar" 
                 style="width: ${percentageValue}%;" 
                 aria-valuenow="${percentageValue}" aria-valuemin="0" aria-valuemax="100">
              
            </div>
            
          </div>
          ${company.percentage}
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-primary view-btn" data-id="${company.id}">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger delete-btn" data-id="${company.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = tableContent;

  // Initialize DataTable
  if ($.fn.DataTable.isDataTable("#company-table")) {
    $("#company-table").DataTable().destroy();
  }
  $("#company-table").DataTable({
    // Add any DataTable options here
  });

  // Add event listeners for view and delete buttons
  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const companyId = this.getAttribute("data-id");
      window.location.href = `/administrator/details/${companyId}`;
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const companyId = this.getAttribute("data-id");
      if (typeof window.showConfirmModal === "function") {
        window.showConfirmModal({
          title: "Hapus Perusahaan",
          message: "Apakah Anda yakin ingin menghapus perusahaan ini?",
          confirmText: "Ya, Hapus",
          onConfirm: () => deleteCompany(companyId)
        });
      } else if (confirm("Are you sure you want to delete this company?")) {
        deleteCompany(companyId);
      }
    });
  });
}

function getPercentageClass(percentage) {
  if (percentage < 50) return "bg-success";
  if (percentage < 75) return "bg-warning";
  return "bg-danger";
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

function setupCreateCompanyForm() {
  const createButton = document.getElementById("create-button");
  const modal = new bootstrap.Modal(document.getElementById("staticBackdrop"));

  createButton.addEventListener("click", function () {
    const companyName = document.getElementById("record-name").value.trim();
    const companyLimit = document.getElementById("record-limit").value.trim();

    if (!companyName || !companyLimit) {
      alert("Please fill in all fields.");
      return;
    }

    const limitValue = parseInt(companyLimit, 10);
    if (isNaN(limitValue) || limitValue <= 0) {
      alert("Limit must be a positive number.");
      return;
    }
    createButton.innerHTML = `
    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
    Loading...
  `;
    createButton.disabled = true;
    createCompany(companyName, limitValue, modal);
  });
}

function createCompany(name, limit, modal) {
  fetch("/api/administrator/v1/company", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, limit }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status_code === "SUCCESSFUL") {
        modal.hide();
        alert("Company created successfully!");
        initializeDataTable();
      } else {
        alert(data.message || "Failed to create company. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error creating company:", error);
      showError(
        "An error occurred while creating the company. Please try again later."
      );
    });
}

function deleteCompany(companyId) {
  fetch(`/api/administrator/v1/company/${companyId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status_code === "SUCCESSFUL") {
        alert("Company deleted successfully!");
        window.location.reload();
      } else {
        alert(data.message || "Failed to delete company. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error deleting company:", error);
      alert(
        "An error occurred while deleting the company. Please try again later."
      );
    });
}
