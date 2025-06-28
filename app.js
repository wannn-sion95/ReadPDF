// Global variables for PDF handling
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let currentScale = 1.5;
let bookmarks = {};
let currentFilename = "";
const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");

// Constants
const PASSWORD_MIN_LENGTH = 6;

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  // Check if already logged in
  if (localStorage.getItem("loggedIn") === "true") {
    showReader();
    loadUserBookmarks();

    // Display username in the reader section
    const username = localStorage.getItem("username");
    document.getElementById(
      "userWelcome"
    ).textContent = `Welcome, ${username}!`;
  }

  // Set up event listeners
  document
    .getElementById("registerForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      register();
    });

  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    login();
  });

  // PDF file input event listener
  document
    .getElementById("pdfFile")
    .addEventListener("change", handleFileUpload);

  // Initialize theme from localStorage
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  document.getElementById("themeSwitch").checked = savedTheme === "dark";
});

// Authentication functions
function showRegister() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("registerSection").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("registerSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "Password harus minimal " + PASSWORD_MIN_LENGTH + " karakter.";
  }
  return null;
}

function hashPassword(password) {
  // This is a simple hash for demo purposes
  // In a real app, use a proper hashing library like bcrypt
  return btoa(password); // Base64 encoding as simple "hash"
}

function register() {
  const newUsername = document.getElementById("newUsername").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document
    .getElementById("confirmPassword")
    .value.trim();
  const error = document.getElementById("registerError");

  // Clear previous errors
  error.textContent = "";

  // Validation
  if (!newUsername || !newPassword) {
    error.textContent = "Username dan password tidak boleh kosong.";
    return;
  }

  if (newPassword !== confirmPassword) {
    error.textContent = "Password dan konfirmasi tidak sama.";
    return;
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    error.textContent = passwordError;
    return;
  }

  // Get users from localStorage
  let users = JSON.parse(localStorage.getItem("users")) || {};

  // Check if username already exists
  if (users[newUsername]) {
    error.textContent = "Username sudah terdaftar.";
    return;
  }

  // Store hashed password
  users[newUsername] = hashPassword(newPassword);
  localStorage.setItem("users", JSON.stringify(users));

  // Initialize user data structures
  initializeUserData(newUsername);

  showNotification("Berhasil mendaftar! Silakan login.");
  showLogin();
}

function initializeUserData(username) {
  // Initialize bookmarks
  let allBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || {};
  if (!allBookmarks[username]) {
    allBookmarks[username] = {};
    localStorage.setItem("bookmarks", JSON.stringify(allBookmarks));
  }

  // Initialize last pages
  let savedPages = JSON.parse(localStorage.getItem("lastPages")) || {};
  if (!savedPages[username]) {
    savedPages[username] = {};
    localStorage.setItem("lastPages", JSON.stringify(savedPages));
  }

  // Initialize reading history
  let history = JSON.parse(localStorage.getItem("readingHistory")) || {};
  if (!history[username]) {
    history[username] = [];
    localStorage.setItem("readingHistory", JSON.stringify(history));
  }
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("loginError");

  // Clear previous errors
  error.textContent = "";

  if (!username || !password) {
    error.textContent = "Username dan password tidak boleh kosong.";
    return;
  }

  let users = JSON.parse(localStorage.getItem("users")) || {};

  if (users[username] && users[username] === hashPassword(password)) {
    // Login successful
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("username", username);

    // Load user data
    loadUserBookmarks();

    // Show reader
    showReader();

    // Display username in the reader section
    document.getElementById(
      "userWelcome"
    ).textContent = `Welcome, ${username}!`;
  } else {
    error.textContent = "Username atau password salah.";
  }
}

function logout() {
  localStorage.removeItem("loggedIn");
  localStorage.removeItem("username");
  location.reload();
}

function showReader() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("readerSection").classList.remove("hidden");
}

// PDF handling functions
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type === "application/pdf") {
    currentFilename = file.name;
    const fileReader = new FileReader();

    // Show loading indicator
    document.getElementById("loadingIndicator").classList.remove("hidden");

    fileReader.onload = function () {
      const typedarray = new Uint8Array(this.result);

      pdfjsLib
        .getDocument(typedarray)
        .promise.then(function (pdf) {
          pdfDoc = pdf;
          totalPages = pdf.numPages;

          const username = localStorage.getItem("username");
          const savedPages =
            JSON.parse(localStorage.getItem("lastPages")) || {};

          // Get last page for this specific book
          if (savedPages[username] && savedPages[username][currentFilename]) {
            currentPage = savedPages[username][currentFilename];
          } else {
            currentPage = 1;
          }

          // Load bookmarks for this book
          loadBookmarks(currentFilename);

          // Save to reading history
          addToHistory(currentFilename);

          renderPage(currentPage);

          // Hide loading indicator
          document.getElementById("loadingIndicator").classList.add("hidden");

          // Show PDF controls
          document.getElementById("pdfControls").classList.remove("hidden");
        })
        .catch(function (error) {
          showNotification("Error loading PDF: " + error.message, "error");
          document.getElementById("loadingIndicator").classList.add("hidden");
        });
    };

    fileReader.onerror = function () {
      showNotification("Error reading file", "error");
      document.getElementById("loadingIndicator").classList.add("hidden");
    };

    fileReader.readAsArrayBuffer(file);
  } else {
    showNotification("Please select a PDF file", "error");
  }
}

function renderPage(num) {
  if (!pdfDoc) return;

  // Show loading indicator
  document.getElementById("loadingIndicator").classList.remove("hidden");

  pdfDoc.getPage(num).then(function (page) {
    const viewport = page.getViewport({ scale: currentScale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    page.render(renderContext).promise.then(function () {
      // Update page info
      document.getElementById(
        "pageInfo"
      ).textContent = `${num} / ${totalPages}`;

      // Save last page
      const username = localStorage.getItem("username");
      if (username && currentFilename) {
        saveLastPage(username, currentFilename, num);
      }

      // Update bookmark button
      updateBookmarkButton();

      // Hide loading indicator
      document.getElementById("loadingIndicator").classList.add("hidden");
    });
  });
}

function nextPage() {
  if (pdfDoc && currentPage < totalPages) {
    currentPage++;
    renderPage(currentPage);
  }
}

function prevPage() {
  if (pdfDoc && currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
}

function goToPage() {
  if (!pdfDoc) return;

  const input = document.getElementById("pageNumberInput");
  const pageNumber = parseInt(input.value);

  if (isNaN(pageNumber)) {
    showNotification("Please enter a valid page number", "error");
    return;
  }

  if (pageNumber >= 1 && pageNumber <= totalPages) {
    currentPage = pageNumber;
    renderPage(currentPage);
  } else {
    showNotification(
      `Page number must be between 1 and ${totalPages}`,
      "error"
    );
  }
}

function zoomIn() {
  if (!pdfDoc) return;
  currentScale += 0.25;
  renderPage(currentPage);
}

function zoomOut() {
  if (!pdfDoc) return;
  if (currentScale > 0.5) {
    currentScale -= 0.25;
    renderPage(currentPage);
  }
}

function resetZoom() {
  if (!pdfDoc) return;
  currentScale = 1.5;
  renderPage(currentPage);
}

// Bookmark functions
function toggleBookmark() {
  if (!pdfDoc || !currentFilename) return;

  const username = localStorage.getItem("username");
  if (!username) return;

  if (isCurrentPageBookmarked()) {
    removeBookmark();
  } else {
    addBookmark();
  }
}

function isCurrentPageBookmarked() {
  if (!bookmarks[currentFilename]) return false;
  return bookmarks[currentFilename].includes(currentPage);
}

function addBookmark() {
  if (!bookmarks[currentFilename]) {
    bookmarks[currentFilename] = [];
  }

  if (!bookmarks[currentFilename].includes(currentPage)) {
    bookmarks[currentFilename].push(currentPage);
    saveBookmarks();
    updateBookmarkButton();
    showNotification("Bookmark added");
  }
}

function removeBookmark() {
  if (!bookmarks[currentFilename]) return;

  const index = bookmarks[currentFilename].indexOf(currentPage);
  if (index !== -1) {
    bookmarks[currentFilename].splice(index, 1);
    saveBookmarks();
    updateBookmarkButton();
    showNotification("Bookmark removed");
  }
}

function updateBookmarkButton() {
  const bookmarkBtn = document.getElementById("bookmarkBtn");
  if (isCurrentPageBookmarked()) {
    bookmarkBtn.textContent = "Remove Bookmark";
    bookmarkBtn.classList.add("active");
  } else {
    bookmarkBtn.textContent = "Add Bookmark";
    bookmarkBtn.classList.remove("active");
  }
}

function saveBookmarks() {
  const username = localStorage.getItem("username");
  if (!username) return;

  let allBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || {};
  allBookmarks[username] = bookmarks;
  localStorage.setItem("bookmarks", JSON.stringify(allBookmarks));
}

function loadUserBookmarks() {
  const username = localStorage.getItem("username");
  if (!username) return;

  let allBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || {};
  bookmarks = allBookmarks[username] || {};
}

function loadBookmarks(filename) {
  const username = localStorage.getItem("username");
  if (!username) return;

  let allBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || {};
  bookmarks = allBookmarks[username] || {};

  updateBookmarkButton();
  renderBookmarksList();
}

function renderBookmarksList() {
  const list = document.getElementById("bookmarksList");
  list.innerHTML = "";

  if (!bookmarks[currentFilename] || bookmarks[currentFilename].length === 0) {
    list.innerHTML = "<li>No bookmarks yet</li>";
    return;
  }

  // Sort bookmarks by page number
  bookmarks[currentFilename].sort((a, b) => a - b);

  bookmarks[currentFilename].forEach((page) => {
    const li = document.createElement("li");
    li.textContent = `Page ${page}`;
    li.addEventListener("click", function () {
      currentPage = page;
      renderPage(currentPage);
      // Hide bookmarks panel on mobile
      if (window.innerWidth < 768) {
        document.getElementById("bookmarksPanel").classList.add("hidden");
      }
    });
    list.appendChild(li);
  });
}

function toggleBookmarksPanel() {
  const panel = document.getElementById("bookmarksPanel");
  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    renderBookmarksList();
  }
}

// History functions
function addToHistory(filename) {
  const username = localStorage.getItem("username");
  if (!username || !filename) return;

  let history = JSON.parse(localStorage.getItem("readingHistory")) || {};
  if (!history[username]) history[username] = [];

  // Remove if already exists
  history[username] = history[username].filter(
    (item) => item.filename !== filename
  );

  // Add to beginning of array
  history[username].unshift({
    filename: filename,
    lastRead: new Date().toISOString(),
  });

  // Keep only last 10 items
  if (history[username].length > 10) {
    history[username] = history[username].slice(0, 10);
  }

  localStorage.setItem("readingHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const username = localStorage.getItem("username");
  if (!username) return;

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  let history = JSON.parse(localStorage.getItem("readingHistory")) || {};
  const userHistory = history[username] || [];

  if (userHistory.length === 0) {
    list.innerHTML = "<li>No reading history yet</li>";
    return;
  }

  userHistory.forEach((item) => {
    const li = document.createElement("li");
    const date = new Date(item.lastRead);
    li.innerHTML = `
      <span class="filename">${item.filename}</span>
      <span class="date">${date.toLocaleDateString()}</span>
    `;
    list.appendChild(li);
  });
}

function toggleHistoryPanel() {
  const panel = document.getElementById("historyPanel");
  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    renderHistory();
  }
}

// Storage helpers
function saveLastPage(username, filename, pageNum) {
  let savedPages = JSON.parse(localStorage.getItem("lastPages")) || {};

  if (!savedPages[username]) {
    savedPages[username] = {};
  }

  savedPages[username][filename] = pageNum;
  localStorage.setItem("lastPages", JSON.stringify(savedPages));
}

// Theme switching
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const newTheme = isDark ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
}

// UI helpers
function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.className = "notification " + type;

  // Show notification
  notification.classList.add("show");

  // Hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Fullscreen mode
function toggleFullscreen() {
  const readerContainer = document.getElementById("readerContainer");

  if (!document.fullscreenElement) {
    // Add event listener for fullscreen change
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Enter fullscreen
    readerContainer.requestFullscreen().catch((err) => {
      showNotification(
        "Error attempting to enable fullscreen: " + err.message,
        "error"
      );
    });

    // Show controls immediately in case they were hidden
    document.getElementById("pdfControls").classList.remove("hidden");

    // Notify user
    showNotification("Press ESC to exit fullscreen mode");
  } else {
    // Exit fullscreen
    document.exitFullscreen();
  }
}

function handleFullscreenChange() {
  const readerContainer = document.getElementById("readerContainer");
  const fullscreenBtn = document.querySelector(
    'button[onclick="toggleFullscreen()"]'
  );

  if (document.fullscreenElement) {
    // We are in fullscreen mode
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    fullscreenBtn.title = "Exit Fullscreen";

    // Adjust canvas size for better viewing
    if (pdfDoc) {
      renderPage(currentPage);
    }

    // Hide sidebars if open
    document.getElementById("bookmarksPanel").classList.add("hidden");
    document.getElementById("historyPanel").classList.add("hidden");
  } else {
    // We exited fullscreen
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    fullscreenBtn.title = "Fullscreen";
    document.removeEventListener("fullscreenchange", handleFullscreenChange);

    // Re-render at normal size
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }
}

// Print current page
function printCurrentPage() {
  if (!pdfDoc) return;

  // Create a new window
  const printWindow = window.open("", "_blank");

  // Get the canvas data as an image
  const imgData = canvas.toDataURL("image/png");

  // Write HTML to the new window
  printWindow.document.write(`
    <html>
    <head>
      <title>Print Page ${currentPage}</title>
      <style>
        body { margin: 0; display: flex; justify-content: center; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      <img src="${imgData}" alt="Page ${currentPage}" />
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
