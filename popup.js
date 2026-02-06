/**
 * Session Snap - Popup Script
 * Handles UI interactions for saving and restoring sessions
 */

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    sessionName: document.getElementById('sessionName'),
    saveBtn: document.getElementById('saveBtn'),
    tabCount: document.getElementById('tabCount'),
    sessionsList: document.getElementById('sessionsList'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importInput: document.getElementById('importInput'),
    searchInput: document.getElementById('searchInput')
  };

  let allSessions = [];

  // Show current tab count
  const tabs = await chrome.tabs.query({ currentWindow: true });
  elements.tabCount.textContent = `📑 ${tabs.length} tabs in current window`;

  // Load and render sessions
  await loadSessions();

  // Search functionality
  elements.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allSessions.filter(s => 
      s.name.toLowerCase().includes(query) ||
      s.tabs.some(t => t.title?.toLowerCase().includes(query) || t.url?.toLowerCase().includes(query))
    );
    renderSessions(filtered);
  });

  async function loadSessions() {
    allSessions = await chrome.runtime.sendMessage({ action: 'getSessions' }) || [];
    renderSessions(allSessions);
  }

  // Save button click
  elements.saveBtn.addEventListener('click', async () => {
    const name = elements.sessionName.value.trim();
    await chrome.runtime.sendMessage({ 
      action: 'saveSession', 
      name: name || `Session - ${new Date().toLocaleDateString()}`
    });
    elements.sessionName.value = '';
    await loadSessions();
    showToast('Session saved! ✓');
  });

  // Enter key to save
  elements.sessionName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.saveBtn.click();
    }
  });

  // Export sessions
  elements.exportBtn.addEventListener('click', async () => {
    const sessions = await chrome.runtime.sendMessage({ action: 'exportSessions' });
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-snap-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Sessions exported! 📤');
  });

  // Import sessions
  elements.importBtn.addEventListener('click', () => {
    elements.importInput.click();
  });

  elements.importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const sessions = JSON.parse(text);
      
      if (!Array.isArray(sessions)) {
        throw new Error('Invalid format');
      }

      await chrome.runtime.sendMessage({ action: 'importSessions', sessions });
      await loadSessions();
      showToast('Sessions imported! 📥');
    } catch (err) {
      showToast('Invalid file format ❌');
    }
    
    elements.importInput.value = '';
  });

  function renderSessions(sessions) {
    if (!sessions || sessions.length === 0) {
      elements.sessionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div>No saved sessions yet</div>
          <div style="font-size: 12px; margin-top: 5px;">Save your first session above!</div>
        </div>
      `;
      return;
    }

    elements.sessionsList.innerHTML = sessions.map(session => `
      <div class="session-item" data-id="${session.id}">
        <div class="session-header">
          <span class="session-name">${escapeHtml(session.name)}</span>
        </div>
        <div class="session-meta">
          <span>📑 ${session.tabs.length} tabs</span>
          <span>🕐 ${formatDate(session.createdAt)}</span>
        </div>
        <div class="session-actions">
          <button class="btn-small restore" data-action="restore">Restore</button>
          <button class="btn-small" data-action="restore-new">New Window</button>
          <button class="btn-small" data-action="rename">Rename</button>
          <button class="btn-small delete" data-action="delete">Delete</button>
        </div>
      </div>
    `).join('');

    // Add event listeners to action buttons
    elements.sessionsList.querySelectorAll('.session-item').forEach(item => {
      const sessionId = item.dataset.id;
      
      item.querySelector('[data-action="restore"]').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'restoreSession', sessionId, newWindow: false });
        showToast('Session restored! ✓');
      });
      
      item.querySelector('[data-action="restore-new"]').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'restoreSession', sessionId, newWindow: true });
        showToast('Opened in new window! ✓');
      });
      
      item.querySelector('[data-action="rename"]').addEventListener('click', async () => {
        const currentName = item.querySelector('.session-name').textContent;
        const newName = prompt('Enter new name:', currentName);
        if (newName && newName.trim()) {
          await chrome.runtime.sendMessage({ action: 'renameSession', sessionId, name: newName.trim() });
          await loadSessions();
        }
      });
      
      item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (confirm('Delete this session?')) {
          await chrome.runtime.sendMessage({ action: 'deleteSession', sessionId });
          await loadSessions();
          showToast('Session deleted');
        }
      });
    });
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(102, 126, 234, 0.9);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 1500);
  }
});
