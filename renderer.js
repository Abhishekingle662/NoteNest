const { ipcRenderer } = require('electron')

let currentNote = null
let currentlyViewedNoteId = null;
const notesList = document.getElementById('notesList')
const noteContent = document.getElementById('noteContent')
const saveButton = document.getElementById('saveNote')
const cancelButton = document.getElementById('cancelEdit')
const noteViewer = document.getElementById('noteViewer')
const viewerContent = document.getElementById('viewerContent')
const viewerTitle = document.getElementById('viewerTitle')
const noteTitleInput = document.getElementById('noteTitle')
const voiceButton = document.getElementById('voiceInput')

// Speech recognition variables
let recognition = null
let isRecording = false

// Initialize speech recognition if supported
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    
    recognition.onstart = () => {
        isRecording = true
        voiceButton.classList.add('recording')
        voiceButton.textContent = '🔴 Recording...'
        voiceButton.title = 'Click to stop recording'
    }
    
    recognition.onresult = (event) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript + ' '
            }
        }
        
        if (transcript.trim()) {
            // Insert the transcript into TinyMCE editor
            const editor = tinymce.get('noteContent')
            if (editor) {
                const currentContent = editor.getContent()
                const newContent = currentContent + transcript
                editor.setContent(newContent)
                // Move cursor to the end
                editor.selection.select(editor.getBody(), true)
                editor.selection.collapse(false)
            }
        }
    }
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        stopRecording()
        
        let errorMessage = 'Voice input error: '
        switch (event.error) {
            case 'no-speech':
                errorMessage += 'No speech detected. Please try again.'
                break
            case 'audio-capture':
                errorMessage += 'Microphone not accessible. Please check permissions.'
                break
            case 'not-allowed':
                errorMessage += 'Microphone access denied. Please allow microphone access.'
                break
            case 'network':
                errorMessage += 'Network error. Please check your connection.'
                break
            default:
                errorMessage += event.error
        }
        alert(errorMessage)
    }
    
    recognition.onend = () => {
        stopRecording()
    }
} else {
    // Hide voice button if speech recognition is not supported
    voiceButton.style.display = 'none'
    console.warn('Speech recognition not supported in this browser')
}

function startRecording() {
    if (!recognition) {
        alert('Speech recognition is not supported in this browser')
        return
    }
    
    // Check if TinyMCE is initialized
    const editor = tinymce.get('noteContent')
    if (!editor) {
        alert('Please wait for the editor to load before using voice input')
        return
    }
    
    try {
        recognition.start()
    } catch (error) {
        console.error('Error starting speech recognition:', error)
        alert('Could not start voice input. Please try again.')
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop()
    }
    isRecording = false
    voiceButton.classList.remove('recording')
    voiceButton.textContent = '🎤 Voice Input'
    voiceButton.title = 'Click to start voice input'
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize TinyMCE
    tinymce.init({
        selector: '#noteContent',
        height: 400,
        menubar: true,
        base_url: './node_modules/tinymce',
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'table', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | formatselect | ' +
            'bold italic backcolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px }'
    }).then(() => {
        console.log('TinyMCE initialized successfully');
    }).catch(err => {
        console.error('TinyMCE initialization failed:', err);
    });
});

// Load notes when app starts
ipcRenderer.send('get-notes')

// Handle notes updates
ipcRenderer.on('notes-updated', (event, notes) => {
  notesList.innerHTML = ''
  notes.forEach(note => {
    const noteElement = document.createElement('div')
    noteElement.className = 'note-item'
    
    const contentDiv = document.createElement('div')
    contentDiv.className = 'note-content'
    contentDiv.textContent = note.title || 'Untitled Note' // Show title instead of content
    
    const buttonsDiv = document.createElement('div')
    buttonsDiv.className = 'button-group'
    
    // View button
    const viewButton = document.createElement('button')
    viewButton.textContent = 'View'
    viewButton.className = 'button view-button'
    viewButton.onclick = (e) => {
      e.stopPropagation()
      currentlyViewedNoteId = note.id
      ipcRenderer.send('view-note', note.id)
    }
    
    // Edit button
    const editButton = document.createElement('button')
    editButton.textContent = 'Edit'
    editButton.className = 'button edit-button'
    editButton.onclick = (e) => {
      e.stopPropagation()
      currentNote = note
      noteTitleInput.value = note.title || ''
      tinymce.get('noteContent').setContent(note.content)
      saveButton.textContent = 'Update Note'
      noteTitleInput.focus()
    }
    
    // Delete button
    const deleteButton = document.createElement('button')
    deleteButton.textContent = 'Delete'
    deleteButton.className = 'button delete-button'
    deleteButton.onclick = (e) => {
      e.stopPropagation()
      if (confirm('Are you sure you want to delete this note?')) {
        ipcRenderer.send('delete-note', note.id)
      }
    }

    buttonsDiv.appendChild(viewButton)
    buttonsDiv.appendChild(editButton)
    buttonsDiv.appendChild(deleteButton)
    noteElement.appendChild(contentDiv)
    noteElement.appendChild(buttonsDiv)
    notesList.appendChild(noteElement)
  })
})

// Save button handler
saveButton.addEventListener('click', () => {
    console.log('Save button clicked'); // Debug log
    
    // Wait for TinyMCE to be initialized
    if (!tinymce.get('noteContent')) {
        console.error('TinyMCE not initialized');
        return;
    }

    const content = tinymce.get('noteContent').getContent();
    const title = noteTitleInput.value.trim();

    console.log('Content:', content); // Debug log
    console.log('Title:', title); // Debug log

    if (!content.trim()) {
        alert('Note content cannot be empty!');
        return;
    }

    const note = {
        id: currentNote ? currentNote.id : Date.now(),
        title: title || 'Untitled Note',
        content: content,
        timestamp: Date.now()
    };

    console.log('Sending note to main process:', note); // Debug log

    // Send to main process
    ipcRenderer.send('save-note', note);

    // Clear the editor
    tinymce.get('noteContent').setContent('');
    noteTitleInput.value = '';
    currentNote = null;
    saveButton.textContent = 'Save Note';
});

// Cancel edit
cancelButton.addEventListener('click', () => {
    tinymce.get('noteContent').setContent('')
    noteTitleInput.value = ''
    currentNote = null
    saveButton.textContent = 'Save Note'
})

// Add handler for displaying notes
ipcRenderer.on('display-note', (event, note) => {
    if (!note) return;
    currentlyViewedNoteId = note.id
    viewerContent.innerHTML = note.content // Change from textContent to innerHTML
    viewerTitle.textContent = note.title || 'Untitled Note'
    noteViewer.style.display = 'block'
})

// Add handler for deleted notes
ipcRenderer.on('note-deleted', (event, noteId) => {
    if (currentlyViewedNoteId === noteId) {
        noteViewer.style.display = 'none'
        viewerContent.textContent = ''
        currentlyViewedNoteId = null
    }
})

// Add error handler
ipcRenderer.on('save-error', (event, errorMessage) => {
    console.error('Save error:', errorMessage);
    alert('Error saving note: ' + errorMessage);
});

// Voice button event listener
voiceButton.addEventListener('click', () => {
    if (isRecording) {
        stopRecording()
    } else {
        startRecording()
    }
})