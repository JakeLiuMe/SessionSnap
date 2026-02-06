/**
 * Session Snap - Background Service Worker
 * Handles session saving, restoring, and keyboard shortcuts
 */

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-save') {
    await quickSaveSession();
  }
});

// Quick save with auto-generated name
async function quickSaveSession() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const session = {
    id: Date.now().toString(),
    name: `Quick Save - ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    tabs: tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned
    }))
  };

  const { sessions = [] } = await chrome.storage.local.get('sessions');
  sessions.unshift(session);
  
  // Keep only last 50 sessions
  if (sessions.length > 50) {
    sessions.pop();
  }
  
  await chrome.storage.local.set({ sessions });
  
  // Show notification badge
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#4ade80' });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSessions') {
    chrome.storage.local.get('sessions').then(({ sessions = [] }) => {
      sendResponse(sessions);
    });
    return true;
  }
  
  if (message.action === 'saveSession') {
    saveSession(message.name).then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (message.action === 'restoreSession') {
    restoreSession(message.sessionId, message.newWindow).then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (message.action === 'deleteSession') {
    deleteSession(message.sessionId).then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (message.action === 'renameSession') {
    renameSession(message.sessionId, message.name).then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (message.action === 'exportSessions') {
    chrome.storage.local.get('sessions').then(({ sessions = [] }) => {
      sendResponse(sessions);
    });
    return true;
  }
  
  if (message.action === 'importSessions') {
    importSessions(message.sessions).then(() => sendResponse({ success: true }));
    return true;
  }
});

async function saveSession(name) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const session = {
    id: Date.now().toString(),
    name: name || `Session ${new Date().toLocaleDateString()}`,
    createdAt: Date.now(),
    tabs: tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned
    }))
  };

  const { sessions = [] } = await chrome.storage.local.get('sessions');
  sessions.unshift(session);
  
  if (sessions.length > 50) {
    sessions.pop();
  }
  
  await chrome.storage.local.set({ sessions });
}

async function restoreSession(sessionId, newWindow = false) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) return;
  
  const urls = session.tabs.map(tab => tab.url).filter(url => url && !url.startsWith('chrome://'));
  
  if (newWindow) {
    await chrome.windows.create({ url: urls });
  } else {
    for (const tab of session.tabs) {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        await chrome.tabs.create({ 
          url: tab.url, 
          pinned: tab.pinned,
          active: false 
        });
      }
    }
  }
}

async function deleteSession(sessionId) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const filtered = sessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ sessions: filtered });
}

async function renameSession(sessionId, name) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.name = name;
    await chrome.storage.local.set({ sessions });
  }
}

async function importSessions(importedSessions) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const merged = [...importedSessions, ...sessions];
  
  // Dedupe by ID
  const unique = merged.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
  
  // Keep only last 100 after import
  if (unique.length > 100) {
    unique.length = 100;
  }
  
  await chrome.storage.local.set({ sessions: unique });
}
