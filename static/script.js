const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const uploadBtn = document.getElementById('uploadBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadTextBtn = document.getElementById('downloadTextBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultDiv = document.getElementById('result');
const resultSection = document.getElementById('resultSection');
const loading = document.getElementById('loading');
const message = document.getElementById('message');
const uploadArea = document.getElementById('uploadArea');

let currentText = '';

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        preview.src = event.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        showMessage('Please select an image file first!', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        uploadBtn.disabled = true;
        loading.style.display = 'block';
        hideMessage();
        resultSection.style.display = 'none';

        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
        } else {
            currentText = data.text;
            resultDiv.value = data.text;
            resultSection.style.display = 'block';
            showMessage('Text recognized successfully!', 'success');
        }
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        loading.style.display = 'none';
    }
});

clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    preview.style.display = 'none';
    resultSection.style.display = 'none';
    resultDiv.value = '';
    currentText = '';
    hideMessage();
});

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(currentText);
        showMessage('Text copied to clipboard!', 'success');
    } catch (error) {
        showMessage('Failed to copy text', 'error');
    }
});

downloadTextBtn.addEventListener('click', () => {
    const blob = new Blob([currentText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geez_ocr_output.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showMessage('Text file downloaded successfully!', 'success');
});

downloadBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/download_pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: currentText })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate PDF');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'geez_ocr_output.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showMessage('PDF downloaded successfully!', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
}

function hideMessage() {
    message.style.display = 'none';
}
