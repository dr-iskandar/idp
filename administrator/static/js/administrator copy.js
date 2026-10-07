async function createCompany(name, limit) {
  try {
    const response = await fetch(`/api/administrator/v1/company`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, limit }),
    });
    const data = await response.json();
    if (response.ok) {
      alert(`Company created successfully. ID: ${data.company_id}`);
      window.location.reload();
    } else {
      throw new Error(data.message || "Failed to create company");
    }
  } catch (error) {
    console.error("Error creating company:", error);
    alert("Failed to create company");
  }
}

// Function to create a user
async function createUser(username, password, role, companyId) {
  try {
    const response = await fetch(`/api/administrator/v1/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, role, companyId }),
    });
    const data = await response.json();
    if (response.ok) {
      showApiKey(data.api_key);
    } else {
      throw new Error(data.message || "Failed to create user");
    }
  } catch (error) {
    console.error("Error creating user:", error);
    alert("Failed to create user");
  }
}
// Function to load companies for the dropdown and usage list
async function loadCompanies() {
  try {
    const response = await fetch(`/api/administrator/v1/companies`);

    if (response.status === 403) {
      throw new Error("Access Forbidden");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status_code === "SUCCESSFUL") {
      console.log(data);
      const companies = data.companies;
      const companySelect = document.getElementById("companyId");
      const usageList = document.getElementById("companyUsageList");

      companySelect.innerHTML = '<option value="">Select Company</option>';
      usageList.innerHTML = "";

      companies.forEach((company) => {
        companySelect.innerHTML += `<option value="${company.id}">${company.name}</option>`;
        const usagePercentage = (company.usage / company.limit) * 100;
        usageList.innerHTML += `
          <li class="flex items-center">
            <span class="w-1/3">${company.name}</span>
            <div class="w-2/3 bg-gray-200 rounded">
              <div class="bg-blue-500 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded"
                   style="width: ${usagePercentage}%">
                ${usagePercentage.toFixed(1)}%
              </div>
            </div>
          </li>
        `;
      });
    } else {
      throw new Error(data.message || "Failed to load companies");
    }
  } catch (error) {
    if (error.message === "Access Forbidden") {
      lockPage(
        "You do not have administrative access to view company information."
      );
    } else {
      console.error("Error loading companies:", error);
      // You might want to show an alert or update the UI to inform the user about the error
      alert("Failed to load companies. Please try again later.");
    }
  }
}
// Function to show API key in modal
function showApiKey(apiKey) {
  const modal = document.getElementById("apiKeyModal");
  const apiKeyDisplay = document.getElementById("apiKeyDisplay");
  apiKeyDisplay.textContent = `Your API Key is: ${apiKey}`;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

// Event Listeners
document
  .getElementById("createCompanyForm")
  .addEventListener("create", function (e) {
    e.preventDefault();
    const name = document.getElementById("companyName").value;
    const limit = document.getElementById("companyLimit").value;
    createCompany(name, parseInt(limit));
  });

document
  .getElementById("createUserForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    const companyId = document.getElementById("companyId").value;
    createUser(username, password, role, companyId);
  });

document.getElementById("closeModal").addEventListener("click", function () {
  document.getElementById("apiKeyModal").classList.add("hidden");
  window.location.reload();
});

// Load companies when the page loads
document.addEventListener("DOMContentLoaded", loadCompanies);

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
