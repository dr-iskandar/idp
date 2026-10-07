document.addEventListener("DOMContentLoaded", function () {
  fetchAnalytics();
});

function fetchAnalytics() {
  Promise.all([
    fetch("/api/analytics/v1/limit"),
    fetch("/api/analytics/v1/usage_summary"),
  ])
    .then(([limitResponse, summaryResponse]) =>
      Promise.all([limitResponse.json(), summaryResponse.json()])
    )
    .then(([limitData, summaryData]) => {
      if (
        limitData.statusCode === "SUCCESSFUL" &&
        summaryData.statusCode === "SUCCESSFUL"
      ) {
        updateDashboard(limitData.data);
        updateUsageSummary(summaryData.data);
      } else {
        console.error("Failed to fetch data");
      }
    })
    .catch((error) => {
      if (error.message === "Access Forbidden") {
        lockPage("You do not have operational access to view this page.");
      } else {
        console.error("Error fetching data:", error);
      }
    });
}

function updateUsageSummary(data) {
  const tableBody = document.getElementById("usage-summary-table-body");
  let tableContent = "";

  for (const [service, users] of Object.entries(data)) {
    users.forEach((user) => {
      tableContent += `
        <tr>
          <td class="text-center">${service}</td>
          <td class="text-center">${user.user}</td>
          <td class="text-center">${user.records}</td>
          <td class="text-center">${user.pages}</td>
        </tr>
      `;
    });
  }

  tableBody.innerHTML = tableContent;

  if ($.fn.DataTable.isDataTable("#usage-summary-table")) {
    $("#usage-summary-table").DataTable().destroy();
  }

  $("#usage-summary-table").DataTable({
    paging: true,
    ordering: true,
    info: true,
    searching: true,
    layout: {
      topStart: "search",
      topEnd: {
        buttons: ["excelHtml5", "csvHtml5"],
      },
    },
  });
}

function updateDashboard(data) {
  // Update usage bar
  const usagePercentage = (data.usage / data.limit) * 100;
  const usageBar = document.getElementById("usage-bar");
  usageBar.style.width = `${usagePercentage}%`;
  usageBar.setAttribute("aria-valuenow", usagePercentage);

  // Update usage text and color
  const usageText = document.getElementById("usage-text");
  usageText.textContent = `${data.usage} / ${
    data.limit
  } pages used (${usagePercentage.toFixed(2)}%)`;

  // Color coding for usage percentage
  if (usagePercentage < 50) {
    usageBar.style.backgroundColor = "#28a745"; // Green
  } else if (usagePercentage < 75) {
    usageBar.style.backgroundColor = "#ffc107"; // Yellow
  } else {
    usageBar.style.backgroundColor = "#dc3545"; // Red
  }

  // Update recent history table
  populateTable(data.recent_history);
}

function populateTable(history) {
  const tableBody = document.getElementById("recent-history-table-body");
  let tableContent = "";

  history.forEach((item) => {
    let typeText =
      item.type === "FaasFs"
        ? "Financial Statement"
        : item.type === "FaasBs"
        ? "Bank Statement"
        : "Trade Finance";
    tableContent += `
          <tr>
          <td class="text-center">${new Date(
            item.created_at
          ).toLocaleString()}</td>
              <td class="text-center">${item.title}</td>
              <td class="text-center">${typeText}</td>
              <td class="text-center">${item.username}</td>
              <td class="text-center">${item.pages}</td>
              <td class="text-center">${item.status}</td>
          </tr>
      `;
  });

  tableBody.innerHTML = tableContent;

  if ($.fn.DataTable.isDataTable("#recent-history-table")) {
    $("#recent-history-table").DataTable().destroy();
  }

  $("#recent-history-table").DataTable({
    spaging: true,
    ordering: true,
    info: true,
    searching: true,
    order: [[0, "desc"]],
    layout: {
      topStart: "search",
      topEnd: {
        buttons: ["excelHtml5", "csvHtml5"],
      },
    },
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
