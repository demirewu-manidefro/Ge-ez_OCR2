// ========== DOM Elements ==========
const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const uploadBtn = document.getElementById('uploadBtn');
const preview = document.getElementById('preview');
const resultImage = document.getElementById('resultImage');
const result = document.getElementById('result');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadTextBtn = document.getElementById('downloadTextBtn');
const downloadBtn = document.getElementById('downloadBtn');
const themeToggle = document.getElementById('themeToggle');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const progressFill = document.getElementById('progressFill');
const message = document.getElementById('message');

// Stats elements
const statImages = document.getElementById('statImages');
const statTime = document.getElementById('statTime');

// Step elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');

// ========== State ==========
let currentText = '';
let imagesProcessed = parseInt(localStorage.getItem('imagesProcessed') || '0');
statImages.textContent = imagesProcessed;

// ========== Theme Toggle ==========
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    } else {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    }
});

// ========== Upload Zone ==========
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
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
        resultImage.src = event.target.result;
        resultsSection.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// ========== Processing & Upload ==========
uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        showMessage('Please select an image file first!', 'error');
        return;
    }

    const startTime = Date.now();
    
    // Show loading UI
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    uploadBtn.disabled = true;
    hideMessage();
    
    // Reset steps
    resetSteps();
    animateStep(step1, 20);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });
        
        animateStep(step2, 40);
        await delay(500);
        
        animateStep(step3, 70);
        await delay(500);
        
        const data = await response.json();
        
        animateStep(step4, 100);
        
        if (data.error) {
            showMessage(data.error, 'error');
        } else {
            currentText = data.text;
            result.value = data.text;
            
            // Update stats
            const endTime = Date.now();
            const timeTaken = ((endTime - startTime) / 1000).toFixed(1);
            statTime.textContent = `${timeTaken}s`;
            
            imagesProcessed++;
            statImages.textContent = imagesProcessed;
            localStorage.setItem('imagesProcessed', imagesProcessed.toString());
            
            await delay(300);
            loadingSection.style.display = 'none';
            resultsSection.style.display = 'block';
            showMessage('Text recognized successfully!', 'success');
        }
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
    }
});

// ========== Button Actions ==========
clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    preview.style.display = 'none';
    resultsSection.style.display = 'none';
    loadingSection.style.display = 'none';
    result.value = '';
    currentText = '';
    progressFill.style.width = '0';
    resetSteps();
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
            headers: { 'Content-Type': 'application/json' },
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

// ========== Helper Functions ==========
function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
}

function hideMessage() {
    message.style.display = 'none';
}

function animateStep(stepElement, progress) {
    // Mark previous steps as completed
    if (stepElement === step1) {
        step1.classList.add('completed');
        step1.classList.add('active');
    } else if (stepElement === step2) {
        step1.classList.remove('active');
        step2.classList.add('completed');
        step2.classList.add('active');
    } else if (stepElement === step3) {
        step2.classList.remove('active');
        step3.classList.add('completed');
        step3.classList.add('active');
    } else if (stepElement === step4) {
        step3.classList.remove('active');
        step4.classList.add('completed');
        step4.classList.add('active');
    }
    
    progressFill.style.width = `${progress}%`;
}

function resetSteps() {
    [step1, step2, step3, step4].forEach(step => {
        step.classList.remove('completed', 'active');
    });
    progressFill.style.width = '0';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
