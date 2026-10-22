// Reusable Modal Component
export const Modal = {
  activeModal: null,

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.close();
      }
    });
  },

  open(title, contentElementOrHtml, footerElementOrHtml = null, maxWidthClass = 'max-w-xl') {
    this.close(); // Close any existing modal

    const overlay = document.createElement('div');
    overlay.id = 'active-modal-overlay';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-backdrop overflow-y-auto';

    const card = document.createElement('div');
    card.className = `relative w-full ${maxWidthClass} bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden modal-content transform scale-95 opacity-0 my-8`;

    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50';

    const h3 = document.createElement('h3');
    h3.className = 'text-lg font-bold text-slate-800';
    if (typeof title === 'string') {
      h3.textContent = title;
    } else {
      h3.appendChild(title);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors focus:outline-none';
    closeBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
    closeBtn.onclick = () => this.close();

    header.appendChild(h3);
    header.appendChild(closeBtn);
    card.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'p-6 max-h-[75vh] overflow-y-auto';
    if (typeof contentElementOrHtml === 'string') {
      body.innerHTML = contentElementOrHtml;
    } else {
      body.appendChild(contentElementOrHtml);
    }
    card.appendChild(body);

    // Footer
    if (footerElementOrHtml) {
      const footer = document.createElement('div');
      footer.className = 'flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50';
      if (typeof footerElementOrHtml === 'string') {
        footer.innerHTML = footerElementOrHtml;
      } else {
        footer.appendChild(footerElementOrHtml);
      }
      card.appendChild(footer);
    }

    // Backdrop click close
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.close();
      }
    };

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.activeModal = overlay;

    // Animation
    requestAnimationFrame(() => {
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');
    });

    return { overlay, card, body };
  },

  close() {
    if (this.activeModal && this.activeModal.parentNode) {
      const card = this.activeModal.querySelector('.modal-content');
      if (card) {
        card.classList.remove('scale-100', 'opacity-100');
        card.classList.add('scale-95', 'opacity-0');
      }
      setTimeout(() => {
        if (this.activeModal && this.activeModal.parentNode) {
          this.activeModal.parentNode.removeChild(this.activeModal);
          this.activeModal = null;
        }
      }, 150);
    }
  }
};

Modal.init();
