// Shared UI Components

/**
 * Create a notification toast
 * @param {string} message - The message to display
 * @param {string} type - Type of notification: 'success', 'error', 'info'
 */
export function showNotification(message, type = 'info') {
  const existing = document.querySelector('.notification-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `notification-toast notification-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Create a confirmation dialog
 * @param {string} message - The confirmation message
 * @returns {Promise<boolean>} - True if confirmed, false if cancelled
 */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-dialog';
    
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Confirm Action</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn-secondary cancel-btn">Cancel</button>
          <button class="btn-primary confirm-btn">Confirm</button>
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Trigger animation
    setTimeout(() => overlay.classList.add('show'), 10);
    
    const cleanup = (result) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };
    
    modal.querySelector('.confirm-btn').addEventListener('click', () => cleanup(true));
    modal.querySelector('.cancel-btn').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

/**
 * Create a loading spinner
 * @param {string} message - Optional loading message
 * @returns {Object} - Object with show() and hide() methods
 */
export function createLoader(message = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.className = 'loader-overlay';
  overlay.innerHTML = `
    <div class="loader-content">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
  
  return {
    show: () => {
      document.body.appendChild(overlay);
      setTimeout(() => overlay.classList.add('show'), 10);
    },
    hide: () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
    }
  };
}

/**
 * Create an empty state message
 * @param {string} icon - Emoji or icon to display
 * @param {string} title - Title of empty state
 * @param {string} description - Description text
 * @returns {HTMLElement} - The empty state element
 */
export function createEmptyState(icon, title, description) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${description}</p>
  `;
  return div;
}

/**
 * Create a card container
 * @param {string} title - Card title
 * @param {HTMLElement|string} content - Card content
 * @param {Array} actions - Array of action buttons {text, onClick, className}
 * @returns {HTMLElement} - The card element
 */
export function createCard(title, content, actions = []) {
  const card = document.createElement('div');
  card.className = 'card';
  
  let html = title ? `<div class="card-header"><h3>${title}</h3></div>` : '';
  html += `<div class="card-body">`;
  
  if (typeof content === 'string') {
    html += content;
  }
  
  html += `</div>`;
  
  if (actions.length > 0) {
    html += `<div class="card-actions">`;
    actions.forEach(action => {
      const btn = `<button class="${action.className || 'btn-secondary'}">${action.text}</button>`;
      html += btn;
    });
    html += `</div>`;
  }
  
  card.innerHTML = html;
  
  if (typeof content !== 'string') {
    card.querySelector('.card-body').appendChild(content);
  }
  
  // Attach event listeners
  actions.forEach((action, idx) => {
    if (action.onClick) {
      card.querySelectorAll('.card-actions button')[idx].addEventListener('click', action.onClick);
    }
  });
  
  return card;
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format a date to a readable string
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Create an emoji picker modal
 * @param {Function} onSelect - Callback when emoji is selected (receives emoji string)
 */
export function showEmojiPicker(onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content emoji-picker-modal';
  
  const title = document.createElement('h3');
  title.textContent = 'Select Emoji or Placeholder';
  title.style.marginBottom = '1rem';
  
  // Placeholders section
  const placeholdersSection = document.createElement('div');
  placeholdersSection.innerHTML = '<h4 style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">Dynamic Placeholders</h4>';
  
  const placeholders = [
    { value: '{{weather_emoji}}', label: '{{weather_emoji}}', desc: 'Weather icon' },
    { value: '{{time_emoji}}', label: '{{time_emoji}}', desc: 'Time-based emoji' }
  ];
  
  const placeholderGrid = document.createElement('div');
  placeholderGrid.style.display = 'grid';
  placeholderGrid.style.gridTemplateColumns = '1fr';
  placeholderGrid.style.gap = '0.5rem';
  placeholderGrid.style.marginBottom = '1.5rem';
  
  placeholders.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'placeholder-btn';
    btn.innerHTML = `<code style="color: var(--accent);">${p.label}</code><span style="font-size: 0.85rem; color: var(--text-dim);"> - ${p.desc}</span>`;
    btn.style.cssText = 'padding: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; text-align: left; transition: all 0.2s;';
    btn.addEventListener('mouseover', () => {
      btn.style.background = 'var(--card-hover)';
      btn.style.borderColor = 'var(--accent)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background = 'var(--bg-secondary)';
      btn.style.borderColor = 'var(--border)';
    });
    btn.addEventListener('click', () => {
      onSelect(p.value);
      document.body.removeChild(overlay);
    });
    placeholderGrid.appendChild(btn);
  });
  
  placeholdersSection.appendChild(placeholderGrid);
  
  // Emojis section
  const emojisSection = document.createElement('div');
  emojisSection.innerHTML = '<h4 style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">Common Emojis</h4>';
  
  const emojis = [
    '💻', '🎮', '🎵', '📚', '🍕', '☕', '🌙', '⭐', '🔥', '💡',
    '🎨', '📱', '⚡', '🌈', '🎯', '🚀', '💪', '🧠', '👀', '✨',
    '❤️', '😊', '😎', '🤔', '😴', '🥳', '🎉', '🎊', '🌟', '💫',
    '🏆', '🎁', '🌸', '🌺', '🌻', '🌼', '🍀', '🌿', '🍃', '🌾'
  ];
  
  const emojiGrid = document.createElement('div');
  emojiGrid.style.display = 'grid';
  emojiGrid.style.gridTemplateColumns = 'repeat(10, 1fr)';
  emojiGrid.style.gap = '0.5rem';
  emojiGrid.style.maxHeight = '250px';
  emojiGrid.style.overflowY = 'auto';
  
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emoji;
    btn.style.cssText = 'padding: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 1.5rem; transition: all 0.2s;';
    btn.addEventListener('mouseover', () => {
      btn.style.transform = 'scale(1.2)';
      btn.style.background = 'var(--card-hover)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.transform = 'scale(1)';
      btn.style.background = 'var(--bg-secondary)';
    });
    btn.addEventListener('click', () => {
      onSelect(emoji);
      document.body.removeChild(overlay);
    });
    emojiGrid.appendChild(btn);
  });
  
  emojisSection.appendChild(emojiGrid);
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.className = 'btn-secondary';
  closeBtn.style.marginTop = '1rem';
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  modal.appendChild(title);
  modal.appendChild(placeholdersSection);
  modal.appendChild(emojisSection);
  modal.appendChild(closeBtn);
  
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  document.body.appendChild(overlay);
}
