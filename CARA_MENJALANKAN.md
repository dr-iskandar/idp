# Panduan Menjalankan Aplikasi DocIDP

Dokumen ini berisi langkah-langkah lengkap untuk melakukan instalasi dan menjalankan aplikasi **DocIDP** di lingkungan lokal setelah melakukan `git clone` / `git pull`.

---

## 📋 Prasyarat Sistem (Prerequisites)

Sebelum menjalankan aplikasi, pastikan sistem Anda sudah terinstal:

1. **Python** (Versi `3.9` - `3.11`)
2. **PostgreSQL Database** (Lokal atau Cloud)
3. **Poppler Utils** (Dibutuhkan oleh library `pdf2image` untuk ekstraksi PDF)
   - **macOS**: `brew install poppler`
   - **Ubuntu/Debian**: `sudo apt-get install -y poppler-utils`
   - **Windows**: Unduh binary Poppler dan tambahkan folder `bin` ke System PATH.
4. **OpenAI API Key** (Dibutuhkan untuk pemrosesan AI Engine / Vision API)

---

## 🚀 Langkah-Langkah Instalasi & Pengoperasian

### 1. Clone Repository

```bash
git clone https://github.com/dr-iskandar/idp.git
cd idp
```

---

### 2. Buat & Aktifkan Virtual Environment

Sangat disarankan untuk menggunakan Virtual Environment Python agar dependensi terisolasi:

**Menggunakan `venv` (Bawaan Python):**
```bash
# Membuat Virtual Environment
python3 -m venv .venv

# Mengaktifkan di macOS / Linux:
source .venv/bin/activate

# Mengaktifkan di Windows (Command Prompt):
.venv\Scripts\activate.bat

# Mengaktifkan di Windows (PowerShell):
.venv\Scripts\Activate.ps1
```

**Atau Menggunakan `conda`:**
```bash
conda create -n docidp python=3.10 -y
conda activate docidp
```

---

### 3. Install Dependensi Python

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

### 4. Konfigurasi Environment Variable (`.env`)

Buat file `.env` di root direktori proyek (`/idp/.env`) dengan isi sesuai konfigurasi berikut:

```env
# Secret Keys
SECRET_KEY=your_flask_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Database URL (PostgreSQL)
# Format: postgresql://<user>:<password>@<host>:<port>/<dbname>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docidp

# Environment Setup
FLASK_ENV=development
PORT=3336
```

> **Catatan Database**: Pastikan database PostgreSQL dengan nama `docidp` sudah dibuat dan service PostgreSQL sedang aktif.

---

### 5. Menjalankan Aplikasi

Jalankan server utama Flask dengan perintah:

```bash
python WideIDP.py
```

Aplikasi akan berjalan secara otomatis di:
👉 **`http://127.0.0.1:3336`** atau **`http://localhost:3336`**

---

## 🛠️ Fitur Utama Aplikasi

1. **Bank Statement Analysis** (`/bank-statement/dashboard`): Modul ekstraksi & rekonsiliasi data Rekening Koran.
2. **Financial Statement Analysis** (`/financial-statement/dashboard`): Modul pemrosesan Laporan Keuangan.
3. **Trade Finance Dashboard** (`/trade-finance/dashboard`): Modul manajemen & ekstraksi dokumen Trade Finance.
4. **AI Reconciliation Playground** (`/playground`): Studio Doc-to-Doc AI Reconciliation modern berbasis OpenAI Vision API dengan perbandingan matriks diskrepansi visual.

---

## ❓ Troubleshoot Sering Terjadi

- **`PopplerNotInstalledError`**: Install Poppler menggunakan `brew install poppler` (macOS) atau `apt-get install poppler-utils` (Linux).
- **`Address already in use (Port 3336)`**: Hentikan proses yang berjalan di port 3336 atau ubah konfigurasi port di `WideIDP.py`.
- **Database Connection Refused**: Pastikan PostgreSQL service berjalan di host & port yang dikonfigurasikan di `.env`.
