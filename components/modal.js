// modal.js - Modal Management
export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = 'auto';
  }
}

// Global exposure for non-module script calls
window.openModal = openModal;
window.closeModal = closeModal;
