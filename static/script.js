document.addEventListener('DOMContentLoaded', () => {
    // ========== DOM Elements ==========
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    const browseBtn = document.getElementById('browseBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const preview = document.getElementById('preview');
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
    const linesContainer = document.getElementById('linesContainer');

    // Step elements
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');

    // ========== State ==========
    let currentResults = [];
    let currentText = '';

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

            // Show loading UI
            if (loadingSection) loadingSection.style.display = 'block';
            if (resultsSection) resultsSection.style.display = 'none';
            if (convertBtnGroup) convertBtnGroup.style.display = 'none';
            uploadBtn.disabled = true;
            hideMessage();
            
            // Reset steps
            resetSteps();
            animateStep(step1, 25);

            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                animateStep(step2, 50);
                await delay(300);

                animateStep(step3, 75);
                await delay(300);

                const data = await response.json();
                animateStep(step4, 100);

                if (data.error) {
                    showMessage(data.error, 'error');
                } else {
                    currentResults = data.results;
                    renderLines();
                    currentText = currentResults.map(r => r.predicted_text).join('\n');
                    await delay(300);
                    if (loadingSection) loadingSection.style.display = 'none';
                    if (resultsSection) resultsSection.style.display = 'block';
                    showMessage('Text recognized and saved to database!', 'success');
                }
            } catch (error) {
                showMessage(error.message, 'error');
            } finally {
                uploadBtn.disabled = false;
            }
        });
    }

    function renderLines() {
        if (!linesContainer) return;
        linesContainer.innerHTML = '';
        currentResults.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'line-item';
            lineDiv.style.cssText = 'background: var(--bg-light); border-radius:12px; padding:1.5rem; display:flex; gap:1.5rem; align-items:flex-start;';
            lineDiv.innerHTML = `
                <img src="${line.image_path}" alt="Line image" style="max-width:300px; border-radius:8px; height:auto;" />
                <div style="flex:1; display:flex; flex-direction:column; gap:0.75rem;">
                    <label style="font-weight:600; color:var(--text-muted);">Predicted Text (Edit to correct):</label>
                    <textarea id="text-${line.id}" style="width:100%; min-height:80px; padding:1rem; border:1px solid var(--border-color); border-radius:8px; font-family:inherit; font-size:1rem; resize:vertical;">${line.predicted_text}</textarea>
                    <div style="display:flex; gap:0.75rem;">
                        <button class="btn-primary" onclick="saveLine(${line.id})" style="padding:0.5rem 1.25rem; font-size:0.9rem;">
                            <i class="fas fa-save"></i> Save Correction
                        </button>
                    </div>
                </div>
            `;
            linesContainer.appendChild(lineDiv);
        });
    }

    window.saveLine = async (id) => {
        const textarea = document.getElementById(`text-${id}`);
        if (!textarea) return;
        try {
            const response = await fetch('/save_label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    ground_truth: textarea.value
                })
            });
            const data = await response.json();
            if (data.error) {
                showMessage(data.error, 'error');
            } else {
                showMessage('Correction saved to database!', 'success');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

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
        currentResults = [];
        currentText = '';
        if (linesContainer) linesContainer.innerHTML = '';
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

    if (document.getElementById('downloadDatasetBtn')) {
        document.getElementById('downloadDatasetBtn').addEventListener('click', async () => {
            try {
                const response = await fetch('/download_dataset');
                
                if (!response.ok) {
                    throw new Error('Failed to download dataset');
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'geez_ocr_dataset.zip';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showMessage('Dataset downloaded successfully!', 'success');
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    if (document.getElementById('fixOldDataBtn')) {
        document.getElementById('fixOldDataBtn').addEventListener('click', async () => {
            try {
                const response = await fetch('/fix_old_data');
                
                if (!response.ok) {
                    throw new Error('Failed to fix old data');
                }
                
                const result = await response.json();
                showMessage(`${result.message}`, 'success');
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
        if (stepElement === step1 && step1) {
            step1.classList.add('completed');
            step1.classList.add('active');
        } else if (stepElement === step2 && step2) {
            if (step1) step1.classList.remove('active');
            step2.classList.add('completed');
            step2.classList.add('active');
        } else if (stepElement === step3 && step3) {
            if (step2) step2.classList.remove('active');
            step3.classList.add('completed');
            step3.classList.add('active');
        } else if (stepElement === step4 && step4) {
            if (step3) step3.classList.remove('active');
            step4.classList.add('completed');
            step4.classList.add('active');
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
