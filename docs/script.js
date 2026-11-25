const translations = {
  id: {
    tagline:"Enkripsi Terbuka<br>untuk Semua Berkas",
    "nav-home":"Beranda","nav-docs":"Dokumentasi","nav-spec":"Spesifikasi","nav-download":"Unduh","nav-community":"Komunitas",
    eyebrow:"FORMAT TERBUKA · CLI · LINTAS PLATFORM",
    "hero-title":'Lindungi Data Anda<br>dengan <span>Standar Terbuka</span>',
    "hero-description":"Alat sederhana, aman, dan lintas platform untuk mengenkripsi serta mendekripsi berkas apa pun, seperti teks, CSV, dan JSON, dengan format terbuka, terdokumentasi, dan dirancang untuk otomatisasi.",
    "download-cta":"Lihat Cara Menggunakan","start-cta":"Mulai Sekarang",
    "hero-note":"Catatan: file terenkripsi tidak menyimpan kunci dekripsi. Kunci yang cocok tetap diperlukan.",
    "benefit-security":"Keamanan Kuat","benefit-security-text":"AES-256-GCM dengan autentikasi integritas",
    "benefit-open":"Terbuka & Transparan","benefit-open-text":"Format berversi dan spesifikasi terdokumentasi",
    "benefit-dev":"Ramah Developer","benefit-dev-text":"CLI, pipe standar, dan integrasi skrip",
    "benefit-platform":"Multi-Platform","benefit-platform-text":"Node.js di Windows, macOS, Linux, dan server",
    "benefit-ready":"Berorientasi Keamanan","benefit-ready-text":"Pengujian, versioning, dan panduan keamanan",
    "platform-title":"Dirancang untuk<br>Lingkungan Anda",
    "cli-title":"CLI (Baris Perintah)","cli-intro":"Satu perintah untuk mengenkripsi atau mendekripsi berkas.",
    "cli-note":"Tersedia di npm. Butuh Node.js 20 atau lebih baru.","read-docs":"Baca dokumentasi →",
    "format-title":"Format Berkas","format-name":"BarongLock Container",
    "format-text":"Format terenkripsi, berversi, dan memiliki autentikasi untuk mendeteksi perubahan data.",
    "format-note":"Ekstensi: .baronglock atau bentuk singkat .blj. Keduanya format yang sama.","read-spec":"Baca spesifikasi →",
    "download-title":"Mulai Menggunakan","download-text":"Gunakan Node.js dan npm/npx. Tidak perlu menginstal dependensi runtime tambahan.",
    "view-github":"Lihat Repository GitHub","unlock-title":"Menemukan file .baronglock atau .blj?",
    "unlock-text":"Kunjungi repository dan dokumentasi resmi untuk mempelajari cara membukanya. Anda tetap memerlukan kunci yang cocok atau akses ke layanan pengelola kunci yang sah.",
    "unlock-cta":"Cara Membuka File","community-issues":"Diskusi & Isu","copied":"Perintah disalin."
  },
  en: {
    tagline:"Open Encryption<br>for Any File",
    "nav-home":"Home","nav-docs":"Documentation","nav-spec":"Specification","nav-download":"Get Started","nav-community":"Community",
    eyebrow:"OPEN FORMAT · CLI · CROSS-PLATFORM",
    "hero-title":'Protect Your Data<br>with <span>Open Standards</span>',
    "hero-description":"A simple, secure, cross-platform tool to encrypt and decrypt any file, such as text, CSV, or JSON, using an open, documented format designed for automation.",
    "download-cta":"See How to Use","start-cta":"Get Started",
    "hero-note":"Note: encrypted files do not contain their decryption key. The matching key is still required.",
    "benefit-security":"Strong Security","benefit-security-text":"AES-256-GCM authenticated encryption",
    "benefit-open":"Open & Transparent","benefit-open-text":"Versioned format and documented specification",
    "benefit-dev":"Developer Friendly","benefit-dev-text":"CLI, standard streams, and script integration",
    "benefit-platform":"Cross-Platform","benefit-platform-text":"Node.js on Windows, macOS, Linux, and servers",
    "benefit-ready":"Security Focused","benefit-ready-text":"Tests, versioning, and security guidance",
    "platform-title":"Designed for<br>Your Environment",
    "cli-title":"Command-Line Interface","cli-intro":"One command to encrypt or decrypt a file.",
    "cli-note":"Available on npm. Requires Node.js 20 or newer.","read-docs":"Read documentation →",
    "format-title":"File Format","format-name":"BarongLock Container",
    "format-text":"A versioned encrypted format with authentication to detect data tampering.",
    "format-note":"Extensions: .baronglock or the short form .blj. Both are the same format.","read-spec":"Read specification →",
    "download-title":"Get Started","download-text":"Use Node.js and npm/npx. No extra runtime dependencies are required.",
    "view-github":"View GitHub Repository","unlock-title":"Found a .baronglock or .blj file?",
    "unlock-text":"Visit the repository and documentation to learn how to open it. You will still need the matching key or authorized access to a key-management service.",
    "unlock-cta":"How to Unlock","community-issues":"Discussions & Issues","copied":"Command copied."
  }
};
const langSelect = document.querySelector("#language-select");
function setLanguage(lang) {
  const dict = translations[lang] || translations.id;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = dict[el.dataset.i18n];
    if (value !== undefined) el.innerHTML = value;
  });
  try { localStorage.setItem("baronglock-language", lang); } catch {}
}
let initial = "id";
try { initial = localStorage.getItem("baronglock-language") || "id"; } catch {}
langSelect.value = initial;
setLanguage(initial);
langSelect.addEventListener("change", () => setLanguage(langSelect.value));
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
    toast.textContent = (translations[langSelect.value] || translations.id).copied;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  } catch {
    toast.textContent = "Copy unavailable; select and copy the command manually.";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }
}));
