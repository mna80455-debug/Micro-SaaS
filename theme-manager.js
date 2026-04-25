export function initTheme() {
  // Apply initial theme from LS
  const shouldDark = localStorage.getItem('bookflow_theme') === 'dark';
  document.documentElement.classList.toggle('dark-theme', shouldDark);

  // Update label if button exists
  const btn = document.getElementById('btnToggleTheme');
  // Helper to update label text using translation if available
  const updateLabel = () => {
    if (!btn) return;
    const isDark = document.documentElement.classList.contains('dark-theme');
    btn.innerHTML = isDark
      ? `<i class="ph-bold ph-sun"></i> ${window?.t?.('light_mode') ?? 'Light'}`
      : `<i class="ph-bold ph-moon"></i> ${window?.t?.('dark_mode') ?? 'Dark'}`;
  };
  // Ensure label reflects current state on load
  updateLabel();

  // Bind once
  if (!btn?.dataset?.bookflowBound) {
    btn.dataset.bookflowBound = '1';
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark-theme');
      document.documentElement.classList.toggle('dark-theme', !isDark);
      localStorage.setItem('bookflow_theme', !isDark ? 'dark' : 'light');
      updateLabel();
    });
  }
}

export function applyThemeFromLS() {
  const shouldDark = localStorage.getItem('bookflow_theme') === 'dark';
  document.documentElement.classList.toggle('dark-theme', shouldDark);
}
