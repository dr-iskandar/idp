// Login.js

function validateForm() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    alert("Please fill in all the fields.");
    return false;
  }
  return true;
}

document.getElementById("login-button").addEventListener("click", async (e) => {
  e.preventDefault(); // Prevent form from submitting normally

  if (validateForm()) {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/api/administrator/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
          plt: "app",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login Success!");
        if (data.role === "administrator") {
          window.location.href = "/administrator";
        } else {
          alert("Invalid Role!");
          window.location.reload();
        }
      } else {
        alert(data.message || "Invalid Username or Password");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
    }
  }
});
