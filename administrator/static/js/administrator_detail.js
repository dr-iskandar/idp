document.addEventListener("DOMContentLoaded", function () {
  initializeDataTable();
  const passwordInput = document.getElementById("password");
  passwordInput.addEventListener("input", updatePasswordStrength);
  setupCreateRoleForm();
});

function initializeDataTable() {
  fetch(`/api/administrator/v1/company?companyId=${companyId}`)
    .then((response) => {
      if (response.status === 403) {
        throw new Error("Access Forbidden");
      }
      return response.json();
    })
    .then((data) => {
      if (data.statusCode === "SUCCESSFUL") {
        populateTable(data.userRole);
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

  companies.forEach((user) => {
    tableContent += `
      <tr>
        <td class="text-center">${user.createdAt}</td>
        <td class="text-center">${user.id}</td>
        <td class="text-center">${user.username}</td>
        <td class="text-center">${user.role}</td>
        
        <td class="text-center">
     
          <button type="button" class="btn btn-sm btn-danger delete-btn" data-id="${user.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = tableContent;

  if ($.fn.DataTable.isDataTable("#tf-table")) {
    $("#tf-table").DataTable().destroy();
  }

  $("#tf-table").DataTable({
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

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const userId = this.getAttribute("data-id");
      if (typeof window.showConfirmModal === "function") {
        window.showConfirmModal({
          title: "Hapus Pengguna",
          message: "Apakah Anda yakin ingin menghapus pengguna ini?",
          confirmText: "Ya, Hapus",
          onConfirm: () => deleteUser(userId)
        });
      } else if (confirm("Are you sure you want to delete this user?")) {
        deleteUser(userId);
      }
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

function setupCreateRoleForm() {
  const createRoleForm = document.getElementById("createRoleForm");
  const createRoleModal = new bootstrap.Modal(
    document.getElementById("createRoleModal")
  );

  createRoleForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const passwordInput = document.getElementById("password");

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = document.getElementById("role").value;

    if (!username || !password || !role) {
      alert("Please fill in all fields.");
      return;
    }

    if (!isPasswordValid(password)) {
      alert(
        "Password must be at least 12 characters long, contain a combination of letters, numbers, and special characters, and not contain spaces."
      );
      return;
    }

    const submitButton = createRoleForm.querySelector('button[type="submit"]');
    submitButton.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      Creating...
    `;
    submitButton.disabled = true;

    createRole(username, password, role, createRoleModal, submitButton);
  });
}

function isPasswordValid(password) {
  // Check length
  if (password.length < 12) return false;

  // Check for spaces
  if (password.includes(" ")) return false;

  // Check for combination of letters, numbers, and special characters
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return hasLetter && hasNumber && hasSpecial;
}

function updatePasswordStrength() {
  const strengthBar = document.getElementById("strength-bar");
  const strengthText = document.getElementById("strength-text");

  const passwordInput = document.getElementById("password");

  const password = passwordInput.value;
  const strength = calculatePasswordStrength(password);

  let color = "";
  let text = "";

  if (strength < 25) {
    color = "#ff4d4d";
    text = "Weak";
  } else if (strength < 50) {
    color = "#ffa64d";
    text = "Moderate";
  } else if (strength < 75) {
    color = "#99cc00";
    text = "Strong";
  } else {
    color = "#33cc33";
    text = "Very Strong";
  }

  strengthBar.style.width = strength + "%";
  strengthBar.style.backgroundColor = color;
  strengthText.textContent = text;
  strengthText.style.color = color;
}

function calculatePasswordStrength(password) {
  let strength = 0;

  // Length
  strength += Math.min(20, password.length) * 2;

  // Lowercase letters
  if (password.match(/[a-z]/)) strength += 10;

  // Uppercase letters
  if (password.match(/[A-Z]/)) strength += 10;

  // Numbers
  if (password.match(/\d/)) strength += 10;

  // Special characters
  if (password.match(/[^a-zA-Z\d]/)) strength += 10;

  // Bonus for mixture
  if (
    password.match(/[a-z]/) &&
    password.match(/[A-Z]/) &&
    password.match(/\d/) &&
    password.match(/[^a-zA-Z\d]/)
  ) {
    strength += 20;
  }

  return Math.min(100, strength);
}

function createRole(username, password, role, modal, submitButton) {
  fetch("/api/administrator/v1/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password, role, companyId }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status_code === "SUCCESSFUL") {
        modal.hide();
        showApiKeyModal(data.api_key);
      } else {
        alert(data.message || "Failed to create role. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error creating role:", error);
      alert(
        "An error occurred while creating the role. Please try again later."
      );
    })
    .finally(() => {
      submitButton.innerHTML = "Create";
      submitButton.disabled = false;
    });
}

function maskApiKey(apiKey) {
  const groups = apiKey.match(/.{1,4}/g);
  return groups.map((group) => "xxxx").join(" - ");
}

function showApiKeyModal(apiKey) {
  const apiKeyModal = new bootstrap.Modal(
    document.getElementById("apiKeyModal")
  );
  const apiKeyDisplay = document.getElementById("apiKeyDisplay");
  const toggleButton = document.getElementById("toggleApiKey");
  const copyButton = document.getElementById("copyApiKey");

  let isVisible = false;
  apiKeyDisplay.value = maskApiKey(apiKey);

  toggleButton.addEventListener("click", function () {
    isVisible = !isVisible;
    apiKeyDisplay.value = isVisible ? apiKey : maskApiKey(apiKey);
    toggleButton.innerHTML = isVisible
      ? '<i class="fa-solid fa-eye-slash"></i>'
      : '<i class="fa-solid fa-eye"></i>';
  });

  copyButton.addEventListener("click", function () {
    navigator.clipboard
      .writeText(apiKey)
      .then(function () {
        copyButton.textContent = "Copied!";
        setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 2000);
      })
      .catch(function (err) {
        console.error("Failed to copy text: ", err);
      });
  });

  apiKeyModal.show();

  // Reload the page after the user closes the API key modal
  document
    .getElementById("apiKeyModal")
    .addEventListener("hidden.bs.modal", function () {
      window.location.reload();
    });
}

function deleteUser(userId) {
  fetch(`/api/administrator/v1/user/${userId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status_code === "SUCCESSFUL") {
        alert("User deleted successfully!");
        window.location.reload();
      } else {
        alert(data.message || "Failed to delete user. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error deleting user:", error);
      alert(
        "An error occurred while deleting the user. Please try again later."
      );
    });
}
