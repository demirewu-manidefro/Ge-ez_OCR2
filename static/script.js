document.addEventListener('DOMContentLoaded', () => {
    // ========== DOM Elements ==========
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    const browseBtn = document.getElementById('browseBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const preview = document.getElementById('preview');
    const resultImage = document.getElementById('resultImage');
    const result = document.getElementById('result');
    const clearBtn = document.getElementById('clearBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const copyBtn = document.getElementById('copyBtn');
    const downloadTextBtn = document.getElementById('downloadTextBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const themeToggle = document.getElementById('themeToggle');
    const loadingSection = document.getElementById('loadingSection');
    const resultsSection = document.getElementById('resultsSection');
    const convertBtnGroup = document.getElementById('convertBtnGroup');
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
    if (statImages) statImages.textContent = imagesProcessed;

    // ========== Theme Toggle ==========
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' && document.body) {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (!document.body) return;
            document.body.classList.toggle('dark-mode');
            if (document.body.classList.contains('dark-mode')) {
                if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                localStorage.setItem('theme', 'dark');
            } else {
                if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // ========== Upload Zone ==========
    if (uploadZone && fileInput && browseBtn) {
        uploadZone.addEventListener('click', () => fileInput.click());
        browseBtn.addEventListener('click', () => fileInput.click());

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
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    function handleFileSelect(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (preview) {
                preview.src = event.target.result;
                preview.style.display = 'block';
            }
            if (resultImage) resultImage.src = event.target.result;
            if (convertBtnGroup) convertBtnGroup.style.display = 'flex';
            if (resultsSection) resultsSection.style.display = 'none';
            if (loadingSection) loadingSection.style.display = 'none';
            hideMessage();
        };
        reader.readAsDataURL(file);
    }

    // ========== Processing & Upload ==========
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                showMessage('Please select an image file first!', 'error');
                return;
            }

            const startTime = Date.now();
            
            // Show loading UI
            if (loadingSection) loadingSection.style.display = 'block';
            if (resultsSection) resultsSection.style.display = 'none';
            if (convertBtnGroup) convertBtnGroup.style.display = 'none';
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
                    if (result) result.value = data.text;
                    
                    // Update stats
                    const endTime = Date.now();
                    const timeTaken = ((endTime - startTime) / 1000).toFixed(1);
                    if (statTime) statTime.textContent = `${timeTaken}s`;
                    
                    imagesProcessed++;
                    if (statImages) statImages.textContent = imagesProcessed;
                    localStorage.setItem('imagesProcessed', imagesProcessed.toString());
                    
                    await delay(300);
                    if (loadingSection) loadingSection.style.display = 'none';
                    if (resultsSection) resultsSection.style.display = 'block';
                    showMessage('Text recognized successfully!', 'success');
                }
            } catch (error) {
                showMessage(error.message, 'error');
            } finally {
                uploadBtn.disabled = false;
            }
        });
    }

    // ========== Button Actions ==========
    if (clearBtn) {
        clearBtn.addEventListener('click', resetToUpload);
    }
    
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', resetToUpload);
    }

    function resetToUpload() {
        if (fileInput) fileInput.value = '';
        if (preview) preview.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'none';
        if (loadingSection) loadingSection.style.display = 'none';
        if (convertBtnGroup) convertBtnGroup.style.display = 'none';
        if (result) result.value = '';
        currentText = '';
        if (progressFill) progressFill.style.width = '0';
        resetSteps();
        hideMessage();
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(currentText);
                showMessage('Text copied to clipboard!', 'success');
            } catch (error) {
                showMessage('Failed to copy text', 'error');
            }
        });
    }

    if (downloadTextBtn) {
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
    }

    if (downloadBtn) {
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
    }

    // ========== Helper Functions ==========
    function showMessage(text, type) {
        if (!message) return;
        message.textContent = text;
        message.className = `message ${type}`;
        message.style.display = 'block';
    }

    function hideMessage() {
        if (!message) return;
        message.style.display = 'none';
    }

    function animateStep(stepElement, progress) {
        if (!progressFill) return;
        // Mark previous steps as completed
        if (stepElement === step1) {
            if (step1) {
                step1.classList.add('completed');
                step1.classList.add('active');
            }
        } else if (stepElement === step2) {
            if (step1) step1.classList.remove('active');
            if (step2) {
                step2.classList.add('completed');
                step2.classList.add('active');
            }
        } else if (stepElement === step3) {
            if (step2) step2.classList.remove('active');
            if (step3) {
                step3.classList.add('completed');
                step3.classList.add('active');
            }
        } else if (stepElement === step4) {
            if (step3) step3.classList.remove('active');
            if (step4) {
                step4.classList.add('completed');
                step4.classList.add('active');
            }
        }
        
        progressFill.style.width = `${progress}%`;
    }

    function resetSteps() {
        [step1, step2, step3, step4].forEach(step => {
            if (step) step.classList.remove('completed', 'active');
        });
        if (progressFill) progressFill.style.width = '0';
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
