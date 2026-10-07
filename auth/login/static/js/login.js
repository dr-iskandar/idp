// Login.js
const publicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtSTO4LH+HGNfCf1YhUyB
jYvDyaC1fOmPBQ0VhKydrlnJOb+6V9zWFCZbvxxzJpqI6Jnehi7w6Ynh5tpbM8xP
nAOnbeUInfJXwckX6Ua9SdWUvPgGtpVKsJKr7drNX/6Dx2uJEt2v/9WWsS3Y3kuq
fD4jpG4xOSy35SajpccMbHZBmdlYZ1lp3k5pU47B4l9wsipFzswOV8IlWvft74KM
axTDdpOett331QTrqAGUl92UrWnyrIe9Rji4HOw3fecziriDZqaN0xWwDX9XgMsu
PnqnKGyWGUWmSJl027FoY1OscMremhiODLBsbvLIgSwSPn20aEznXcnC6AgoT40t
AwIDAQAB
-----END PUBLIC KEY-----
`;

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
    document.getElementById("login-button").innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Loading...
      `;
    document.getElementById("login-button").disabled = true;

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const publicKey = await importPublicKey(publicKeyPEM);
      const encryptedUsername = await encryptData(publicKey, username);
      const encryptedUsernameBase64 = btoa(
        String.fromCharCode.apply(null, new Uint8Array(encryptedUsername))
      );
      const encryptedPassword = await encryptData(publicKey, password);
      const encryptedPasswordBase64 = btoa(
        String.fromCharCode.apply(null, new Uint8Array(encryptedPassword))
      );

      const response = await fetch("/api/user/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: encryptedUsernameBase64,
          password: encryptedPasswordBase64,
          plt: "app",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login Success!");
        if (data.status_code === "OTP_REQUIRED") {
          showOTPPrompt(username);
        } else if (data.status_code === "SUCCESSFUL") {
          handleSuccessfulLogin(data);
        } else {
          alert(data.message || "Unexpected response from server");
          document.getElementById("login-button").innerHTML = `
        
        Login
      `;
          document.getElementById("login-button").disabled = false;
        }
      } else {
        alert(data.message || "Login failed. Please try again.");
        document.getElementById("login-button").innerHTML = `
        
        Login
      `;
        document.getElementById("login-button").disabled = false;
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
      document.getElementById("login-button").innerHTML = `
        
        Login
      `;
      document.getElementById("login-button").disabled = false;
    }
  }
});

function showOTPPrompt(username) {
  const otpModal = new bootstrap.Modal(document.getElementById("otpModal"));
  otpModal.show();

  document
    .getElementById("verifyOtpButton")
    .addEventListener("click", async () => {
      document.getElementById("verifyOtpButton").innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Loading...
      `;
      document.getElementById("verifyOtpButton").disabled = true;
      const otp = document.getElementById("otpInput").value;
      if (otp) {
        try {
          const response = await fetch("/api/user/v1/verify-otp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: username,
              otp: otp,
            }),
          });

          const data = await response.json();

          if (data.status_code === "SUCCESSFUL") {
            otpModal.hide();
            if (data.warning) {
              showPasswordWarning(data.warning);
            }
            if (data.role === "analyst") {
              window.location.href = "/bank-statement";
            } else if (data.role === "operational") {
              window.location.href = "/home";
            } else {
              alert("Invalid Role!");
              window.location.reload();
            }
          } else {
            alert(data.message || "Invalid OTP. Please try again.");
            document.getElementById("verifyOtpButton").innerHTML = `
        
        Verify OTP
      `;
            document.getElementById("verifyOtpButton").disabled = false;
          }
        } catch (error) {
          console.error("Error:", error);
          alert("An error occurred while verifying OTP. Please try again.");
          document.getElementById("verifyOtpButton").innerHTML = `
        Verify OTP
      `;
          document.getElementById("verifyOtpButton").disabled = false;
        }
      } else {
        alert("Please enter the OTP.");
        document.getElementById("verifyOtpButton").innerHTML = `
        
        Verify OTP
      `;
        document.getElementById("verifyOtpButton").disabled = false;
      }
    });
}

function showPasswordWarning(message) {
  // You can implement this as a modal, alert, or any other UI element
  alert(message);
}

function showError(message) {
  // Implement error display logic
  alert(message);
}

function handleSuccessfulLogin(data) {
  if (data.warning) {
    showPasswordWarning(data.warning);
  }
  if (data.role === "analyst") {
    window.location.href = "/bank-statement";
  } else if (data.role === "operational") {
    window.location.href = "/home";
  } else {
    alert("Invalid Role!");
    window.location.reload();
  }
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
