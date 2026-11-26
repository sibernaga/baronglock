const translations = {
  id: {
    tagline:"Enkripsi Terbuka<br>untuk Semua Berkas",
    "nav-home":"Beranda","nav-docs":"Dokumentasi","nav-editor":"VS Code","nav-spec":"Spesifikasi","nav-download":"Unduh","nav-community":"Komunitas",
    eyebrow:"FORMAT TERBUKA · CLI · VS CODE · LINTAS PLATFORM",
    "hero-title":'Lindungi Data Anda<br>dengan <span>Standar Terbuka</span>',
    "hero-description":"Alat sederhana, aman, dan lintas platform untuk mengenkripsi serta mendekripsi berkas apa pun, seperti teks, CSV, dan JSON, dengan format terbuka, terdokumentasi, dan dirancang untuk otomatisasi.",
    "download-cta":"Lihat Cara Menggunakan","start-cta":"Mulai Sekarang",
    "hero-note":"Catatan: file terenkripsi tidak menyimpan kunci dekripsi. Anda memerlukan kunci yang cocok, atau kata sandinya jika file dikunci dengan kata sandi.",
    "benefit-security":"Keamanan Kuat","benefit-security-text":"AES-256-GCM dengan autentikasi integritas",
    "benefit-open":"Terbuka & Transparan","benefit-open-text":"Format berversi dan spesifikasi terdokumentasi",
    "benefit-dev":"Ramah Developer","benefit-dev-text":"CLI, ekstensi VS Code, dan integrasi skrip",
    "benefit-platform":"Multi-Platform","benefit-platform-text":"Node.js di Windows, macOS, Linux, dan server",
    "benefit-ready":"Berorientasi Keamanan","benefit-ready-text":"Pengujian, versioning, dan panduan keamanan",
    "platform-title":"Dirancang untuk<br>Lingkungan Anda","platform-node":"v20 atau lebih baru",
    "page-title":"BarongLock — Lindungi Data dengan Standar Terbuka",
    "cli-title":"CLI (Baris Perintah)","cli-intro":"Satu perintah untuk mengunci atau membuka berkas, dengan kunci atau kata sandi.",
    "cli-note":"Tersedia di npm. Butuh Node.js 20 atau lebih baru.","read-docs":"Baca dokumentasi →",
    "format-title":"Format Berkas","format-name":"BarongLock Container",
    "format-text":"Format terenkripsi, berversi, dan memiliki autentikasi untuk mendeteksi perubahan data.",
    "format-note":"Ekstensi: .baronglock atau bentuk singkat .blj. Keduanya format yang sama.","read-spec":"Baca spesifikasi →",
    "download-title":"Mulai Menggunakan","download-text":"Gunakan Node.js dan npm/npx. Tidak perlu menginstal dependensi runtime tambahan.",
    "view-github":"Lihat Repository GitHub","unlock-title":"Menemukan file .baronglock atau .blj?",
    "unlock-text":"Kunjungi repository dan dokumentasi resmi untuk mempelajari cara membukanya. Anda tetap memerlukan kunci yang cocok atau kata sandinya, atau akses ke layanan pengelola kunci yang sah.",
    "unlock-cta":"Cara Membuka File","community-issues":"Diskusi & Isu","copied":"Perintah disalin.",
    "editor-eyebrow":"EKSTENSI VS CODE","editor-title":'Edit berkas terkunci<br>langsung di <span>VS Code</span>',
    "editor-text":"Klik berkas .blj atau .baronglock, dan berkas terbuka sebagai teks biasa. Simpan, dan berkas terkunci lagi. Berkas di disk tidak pernah dibiarkan terbuka.",
    "editor-point-open":"Buka berkas terkunci dengan satu klik",
    "editor-point-save":"Setiap kali disimpan, berkas dikunci lagi dengan cara yang sama",
    "editor-point-lock":"Kunci berkas apa pun dari Explorer, dengan kunci atau kata sandi",
    "editor-point-forks":"Juga untuk Cursor dan VSCodium, melalui Open VSX",
    "editor-cta":"Dapatkan di Marketplace","editor-guide":"Panduan ekstensi","footer-editor":"Ekstensi VS Code"
  },
  en: {
    tagline:"Open Encryption<br>for Any File",
    "nav-home":"Home","nav-docs":"Documentation","nav-editor":"VS Code","nav-spec":"Specification","nav-download":"Get Started","nav-community":"Community",
    eyebrow:"OPEN FORMAT · CLI · VS CODE · CROSS-PLATFORM",
    "hero-title":'Protect Your Data<br>with <span>Open Standards</span>',
    "hero-description":"A simple, secure, cross-platform tool to encrypt and decrypt any file, such as text, CSV, or JSON, using an open, documented format designed for automation.",
    "download-cta":"See How to Use","start-cta":"Get Started",
    "hero-note":"Note: encrypted files do not contain their decryption key. You need the matching key, or the password if the file was locked with one.",
    "benefit-security":"Strong Security","benefit-security-text":"AES-256-GCM authenticated encryption",
    "benefit-open":"Open & Transparent","benefit-open-text":"Versioned format and documented specification",
    "benefit-dev":"Developer Friendly","benefit-dev-text":"CLI, VS Code extension, and script integration",
    "benefit-platform":"Cross-Platform","benefit-platform-text":"Node.js on Windows, macOS, Linux, and servers",
    "benefit-ready":"Security Focused","benefit-ready-text":"Tests, versioning, and security guidance",
    "platform-title":"Designed for<br>Your Environment","platform-node":"v20 or newer",
    "page-title":"BarongLock — Protect Your Data with Open Standards",
    "cli-title":"Command-Line Interface","cli-intro":"One command to lock or unlock a file, with a key or a password.",
    "cli-note":"Available on npm. Requires Node.js 20 or newer.","read-docs":"Read documentation →",
    "format-title":"File Format","format-name":"BarongLock Container",
    "format-text":"A versioned encrypted format with authentication to detect data tampering.",
    "format-note":"Extensions: .baronglock or the short form .blj. Both are the same format.","read-spec":"Read specification →",
    "download-title":"Get Started","download-text":"Use Node.js and npm/npx. No extra runtime dependencies are required.",
    "view-github":"View GitHub Repository","unlock-title":"Found a .baronglock or .blj file?",
    "unlock-text":"Visit the repository and documentation to learn how to open it. You will still need the matching key or its password, or authorized access to a key-management service.",
    "unlock-cta":"How to Unlock","community-issues":"Discussions & Issues","copied":"Command copied.",
    "editor-eyebrow":"VS CODE EXTENSION","editor-title":'Edit locked files<br>right in <span>VS Code</span>',
    "editor-text":"Click a .blj or .baronglock file and it opens as normal text. Save, and it is locked again. The file on disk is never left unlocked.",
    "editor-point-open":"Open locked files with one click",
    "editor-point-save":"Every save locks the file again, the same way",
    "editor-point-lock":"Lock any file from the Explorer, with a key or a password",
    "editor-point-forks":"Also for Cursor and VSCodium, through Open VSX",
    "editor-cta":"Get it on the Marketplace","editor-guide":"Extension guide","footer-editor":"VS Code extension"
  }
};
// English is the default. Only an explicit click is remembered. (The old
// "baronglock-language" key was saved automatically as "id" for every visitor,
// so a new key is used to give returning visitors the English default too.)
const LANG_KEY = "baronglock-lang";
const langButtons = document.querySelectorAll(".lang-option");
let currentLang = "en";
function setLanguage(lang) {
  if (!translations[lang]) lang = "en";
  currentLang = lang;
  const dict = translations[lang];
  document.documentElement.lang = lang;
  document.title = dict["page-title"];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = dict[el.dataset.i18n];
    if (value !== undefined) el.innerHTML = value;
  });
  langButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}
let saved = null;
try { saved = localStorage.getItem(LANG_KEY); } catch {}
if (saved && saved !== "en") setLanguage(saved);
langButtons.forEach(button => button.addEventListener("click", () => {
  setLanguage(button.dataset.lang);
  try { localStorage.setItem(LANG_KEY, currentLang); } catch {}
}));
document.querySelector("#year").textContent = new Date().getFullYear();

const menuToggle = document.querySelector("#menu-toggle");
const nav = document.querySelector("#main-nav");
menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));

const toast = document.querySelector("#toast");
document.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    toast.textContent = translations[currentLang].copied;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  } catch {
    toast.textContent = "Copy unavailable; select and copy the command manually.";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }
}));
