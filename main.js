const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let activeNoteId = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true
    }
  })

  // Set proper CSP headers
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://cdn.tiny.cloud https://sp.tinymce.com; " +
          "script-src 'self' 'unsafe-inline' https://cdn.tiny.cloud; " +
          "style-src 'self' 'unsafe-inline' https://cdn.tiny.cloud; " +
          "img-src 'self' data: https://cdn.tiny.cloud https://sp.tinymce.com; " +
          "font-src 'self' https://cdn.tiny.cloud; " +
          "connect-src 'self' https://cdn.tiny.cloud https://sp.tinymce.com; " +
          "media-src 'self'"
        ]
      }
    })
  })

  // Load the index.html file directly
  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})

// Handle note operations
ipcMain.on('save-note', (event, note) => {
  const notesPath = path.join(app.getPath('userData'), 'notes.json');
  console.log('Notes path:', notesPath); // Debug log
  let notes = [];
  
  try {
    // Create the file if it doesn't exist
    if (!fs.existsSync(notesPath)) {
      fs.writeFileSync(notesPath, JSON.stringify([], null, 2));
    }

    // Read existing notes
    const fileContent = fs.readFileSync(notesPath, 'utf8');
    try {
      notes = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('Error parsing notes file:', parseError);
      notes = [];
    }

    // Add or update note
    if (note.id) {
      const index = notes.findIndex(n => n.id === note.id);
      if (index !== -1) {
        notes[index] = note;
      } else {
        notes.push(note);
      }
      console.log('Updated existing note'); // Debug log
    } else {
      note.id = Date.now(); // Ensure unique ID
      notes.push(note);
      console.log('Added new note'); // Debug log
    }
    
    // Save to file
    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2), 'utf8');
    console.log('Notes saved successfully'); // Debug log
    console.log('Current notes:', notes); // Debug log
    
    event.reply('notes-updated', notes);
    
    if (note.id === activeNoteId) {
      event.reply('display-note', note);
    }
  } catch (error) {
    console.error('Error saving note:', error);
    event.reply('save-error', error.message);
  }
});

ipcMain.on('get-notes', (event) => {
  const notesPath = path.join(app.getPath('userData'), 'notes.json')
  let notes = []
  
  if (fs.existsSync(notesPath)) {
    notes = JSON.parse(fs.readFileSync(notesPath))
  }
  
  event.reply('notes-updated', notes)
})

ipcMain.on('delete-note', (event, noteId) => {
  const notesPath = path.join(app.getPath('userData'), 'notes.json')
  let notes = JSON.parse(fs.readFileSync(notesPath))
  notes = notes.filter(note => note.id !== noteId)
  fs.writeFileSync(notesPath, JSON.stringify(notes))
  
  if (noteId === activeNoteId) {
    event.reply('note-deleted', noteId) // Notify viewer about deletion
  }
  event.reply('notes-updated', notes)
})

ipcMain.on('view-note', (event, noteId) => {
  const notesPath = path.join(app.getPath('userData'), 'notes.json')
  let notes = JSON.parse(fs.readFileSync(notesPath))
  const note = notes.find(note => note.id === noteId)
  activeNoteId = noteId // Store the active note ID
  event.reply('display-note', note)
})