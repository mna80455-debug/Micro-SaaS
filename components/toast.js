// toast.js - Toast Notifications
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type} fade-up`;
  
  const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
  
  toast.innerHTML = `
    <i class="ph-bold ${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function createToastContainer() {
  const div = document.createElement('div');
  div.id = 'toastContainer';
  document.body.appendChild(div);
  return div;
}

window.showToast = showToast;
