let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const btn = document.getElementById("installPWA");
  if (btn) btn.style.display = "inline-flex";
});

window.addEventListener("appinstalled", () => {
  const btn = document.getElementById("installPWA");
  if (btn) btn.style.display = "none";
});

function installPWA() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  deferredPrompt = null;

  const btn = document.getElementById("installPWA");
  if (btn) btn.style.display = "none";
}

window.installPWA = installPWA;
