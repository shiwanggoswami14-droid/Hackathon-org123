/**
 * ScamShield AI — Primary UI Controller & DOM Orchestration (Light SaaS Theme)
 * Simple, intuitive, beginner-friendly experience across Desktop & Mobile.
 */

const UIController = {
  currentAnalysis: null,
  activeCheckerMode: 'message', // 'message' | 'link' | 'screenshot'

  init() {
    this.bindNavigation();
    this.bindCheckerModeTabs();
    this.bindMessageChecker();
    this.bindLinkChecker();
    this.bindSandboxChecker();
    this.bindScreenshotUploader();
    this.bindRecoveryAssistant();
    this.bindReportModal();
    this.renderReportsTable();
    renderIcons();
    this.refreshBackendHealth();
    this.applyLocationHash();
    window.addEventListener('popstate', () => this.applyLocationHash());
    window.addEventListener('hashchange', () => this.applyLocationHash());
  },

  /**
   * Navigation & View Switching
   */
  bindNavigation() {
    const navLinks = document.querySelectorAll('[data-view-target]');
    const viewPanels = document.querySelectorAll('.view-panel');
    const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
    const navLinksList = document.getElementById('nav-links-list');

    window.switchView = (targetViewId, checkerMode = null, options = {}) => {
      viewPanels.forEach(panel => {
        if (panel.id === targetViewId) {
          panel.classList.add('active-view');
        } else {
          panel.classList.remove('active-view');
        }
      });

      // Update active nav link
      navLinks.forEach(link => {
        if (link.getAttribute('data-view-target') === targetViewId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // Close mobile drawer if open
      if (navLinksList && navLinksList.classList.contains('is-active')) {
        navLinksList.classList.remove('is-active');
      }

      // If a specific checker mode is requested (e.g. from home feature cards)
      if (checkerMode && targetViewId === 'view-checker') {
        this.setCheckerMode(checkerMode, { fromHash: Boolean(options.fromHash) });
      }

      // Refresh reports table if switching to reports
      if (targetViewId === 'view-reports') {
        this.renderReportsTable();
      }

      if (!options.fromHash) {
        this.syncLocationHash(targetViewId, checkerMode || this.activeCheckerMode);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-view-target');
        const mode = link.getAttribute('data-checker-mode');
        window.switchView(target, mode);
      });
    });

    // Mobile nav toggle
    if (mobileMenuBtn && navLinksList) {
      mobileMenuBtn.addEventListener('click', () => {
        navLinksList.classList.toggle('is-active');
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!mobileMenuBtn.contains(e.target) && !navLinksList.contains(e.target)) {
          navLinksList.classList.remove('is-active');
        }
      });
    }
  },

  /**
   * Main Scam Checker Segmented Mode Switcher
   * IMPORTANT: Shows ONLY the selected interface (Message, Link, or Screenshot)
   */
  bindCheckerModeTabs() {
    const tabButtons = document.querySelectorAll('.segmented-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.setCheckerMode(mode);
      });
    });
  },

  viewHashName(viewId) {
    return {
      'view-home': 'home',
      'view-checker': 'checker',
      'view-reports': 'reports',
      'view-recovery': 'recovery',
      'view-about': 'about'
    }[viewId] || 'home';
  },

  syncLocationHash(viewId, checkerMode) {
    let hash = '#' + this.viewHashName(viewId);
    if (viewId === 'view-checker' && checkerMode && checkerMode !== 'message') {
      hash += '/' + checkerMode;
    }
    if (window.location.hash !== hash) {
      history.pushState({ view: viewId, mode: checkerMode || null }, '', hash);
    }
  },

  applyLocationHash() {
    const raw = (window.location.hash || '#home').replace(/^#/, '');
    const [viewKey, modePart] = raw.split('/');
    const viewMap = {
      home: 'view-home',
      checker: 'view-checker',
      reports: 'view-reports',
      recovery: 'view-recovery',
      about: 'view-about'
    };
    const viewId = viewMap[(viewKey || 'home').toLowerCase()] || 'view-home';
    const mode = viewId === 'view-checker' ? (modePart || 'message') : null;
    const current = document.querySelector('.view-panel.active-view');
    if (current && current.id === viewId && (!mode || this.activeCheckerMode === mode)) {
      return;
    }
    if (typeof window.switchView === 'function') {
      window.switchView(viewId, mode, { fromHash: true });
    }
  },

  
  async parseJsonResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Log full detail to browser console for debugging
    if (!contentType.toLowerCase().includes('application/json')) {
      console.error('[ScamShield] Non-JSON response:', {
        status: response.status,
        contentType,
        preview: text.slice(0, 400)
      });
      const portHint = (window.location.port && window.location.port !== '5000')
        ? ` You are on port ${window.location.port} — open http://127.0.0.1:5000/ instead.`
        : '';
      throw new Error(
        `Server returned HTTP ${response.status} with type "${contentType}" instead of JSON.${portHint} ` +
        `Preview: "${text.slice(0, 100).replace(/\s+/g, ' ')}"`
      );
    }

    try {
      return JSON.parse(text);
    } catch (_parseError) {
      console.error('[ScamShield] JSON parse error:', { status: response.status, text });
      throw new Error(
        `Server returned HTTP ${response.status} but the body is not valid JSON. ` +
        `Preview: "${text.slice(0, 100).replace(/\s+/g, ' ')}"`
      );
    }
  },

  async refreshBackendHealth() {
    const statusEl = document.getElementById('screenshot-ocr-status');
    try {
      const response = await fetch('/api/health');
      const data = await this.parseJsonResponse(response);
      if (!statusEl) return;
      if (data.ocr && data.ocr.available) {
        statusEl.textContent = data.ocr.detail || 'Tesseract OCR is ready for screenshot analysis.';
      } else {
        const detail = (data.ocr && data.ocr.detail) || 'Tesseract OCR is not available on this server.';
        statusEl.textContent = `${detail} Use Try Sample Screenshot for an offline demo.`;
      }
    } catch (_error) {
      if (statusEl) {
        statusEl.textContent = 'Analysis server not reachable. Run python app.py so message, URL, and screenshot checks can work. The sample screenshot still runs as an offline demo.';
      }
    }
  },

  setCheckerMode(mode, options = {}) {
    this.activeCheckerMode = mode;
    const tabButtons = document.querySelectorAll('.segmented-tab-btn');
    const modePanels = document.querySelectorAll('.checker-mode-panel');

    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-mode') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    modePanels.forEach(panel => {
      if (panel.id === `checker-mode-${mode}`) {
        panel.classList.add('active-mode');
      } else {
        panel.classList.remove('active-mode');
      }
    });

    // Hide previous analysis result when switching mode for clean UX
    const resultsContainer = document.getElementById('checker-results-container');
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
    }

    const checkerView = document.getElementById('view-checker');
    if (!options.fromHash && checkerView && checkerView.classList.contains('active-view')) {
      this.syncLocationHash('view-checker', mode);
    }
  },

  /**
   * Toast Notifications
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'checkCircle';
    if (type === 'warning') iconName = 'alertTriangle';
    if (type === 'danger') iconName = 'alertCircle';

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = ICONS[iconName] || ICONS.info;
    const messageText = document.createElement('span');
    messageText.textContent = message;
    toast.append(icon, messageText);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  },

  /**
   * OPTION A: Message / Email Checker
   */
  bindMessageChecker() {
    const form = document.getElementById('message-checker-form');
    const input = document.getElementById('message-input');
    const clearBtn = document.getElementById('clear-message-btn');
    const submitBtn = document.getElementById('analyze-message-btn');
    const chipsContainer = document.getElementById('message-preset-chips');

    // Populate preset chips
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      THREAT_PRESETS.forEach(preset => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = preset.title;
        chip.title = preset.description;
        chip.addEventListener('click', () => {
          input.value = preset.text;
          input.focus();
          this.showToast(`Loaded sample: "${preset.title}"`, 'info', 2000);
        });
        chipsContainer.appendChild(chip);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        document.getElementById('checker-results-container').style.display = 'none';
        this.currentAnalysis = null;
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) {
          this.showToast('Please paste a suspicious message or email first.', 'warning');
          return;
        }

        const oldHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span> Checking Message...`;

        try {
          const response = await fetch('/api/analyze-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });
          const analysis = await this.parseJsonResponse(response);
          if (!response.ok) {
            throw new Error(analysis.error || 'Message analysis failed. Please try again.');
          }

          this.currentAnalysis = analysis;
          this.renderResults(analysis, "Message Analysis", text);

          // Save to local storage
          StorageManager.addRecord({
            type: "Message / Email",
            preview: text,
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            badgeClass: analysis.riskBadgeClass,
            details: analysis
          });

          this.showToast('Analysis completed.', 'success');
        } catch (error) {
          this.showToast(error.message || 'Unable to reach the analysis service. Please try again.', 'danger');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = oldHtml;
        }
      });
    }
  },

  /**
   * OPTION B: Website Link Checker
   */
  bindLinkChecker() {
    const form = document.getElementById('link-checker-form');
    const input = document.getElementById('link-input');
    const submitBtn = document.getElementById('analyze-link-btn');
    const chipsContainer = document.getElementById('link-preset-chips');

    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      SAMPLE_URLS.forEach(sample => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = sample.label;
        chip.addEventListener('click', () => {
          input.value = sample.url;
          input.focus();
        });
        chipsContainer.appendChild(chip);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = input.value.trim();
        if (!url) {
          this.showToast('Please enter a website link to check.', 'warning');
          return;
        }

        const oldHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span> Checking Link...`;

        try {
          const response = await fetch('/api/analyze-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const analysis = await this.parseJsonResponse(response);
          if (!response.ok) {
            throw new Error(analysis.error || 'URL analysis failed. Please try again.');
          }

          this.currentAnalysis = analysis;
          this.renderResults(analysis, "Website Link Check", url);

          StorageManager.addRecord({
            type: "Website Link",
            preview: url,
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            badgeClass: analysis.riskBadgeClass,
            details: analysis
          });

          this.showToast('Link check complete.', 'success');
        } catch (error) {
          this.showToast(error.message || 'Unable to reach the analysis service. Please try again.', 'danger');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = oldHtml;
        }
      });
    }
  },

  /**
   * OPTION C (Sandbox): ScamBait Sandbox local URL pattern inspection
   */
  bindSandboxChecker() {
    const form = document.getElementById('sandbox-inspection-form');
    const input = document.getElementById('sandbox-url-input');
    const submitBtn = document.getElementById('sandbox-inspect-btn');
    if (!form || !input || !submitBtn) return;

    const setField = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    const inspect = async () => {
      const url = input.value.trim();
      if (!url) {
        this.showToast('Please enter a website link to inspect.', 'warning');
        return;
      }

      const oldHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Inspecting Link...';

      try {
        const response = await fetch('/api/analyze-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const analysis = await this.parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(analysis.error || 'URL inspection failed. Please try again.');
        }

        setField('sandbox-redirect-chain', 'Not run. No website was fetched or opened.');
        setField('sandbox-final-url', analysis.url || url);
        setField('sandbox-screenshot-preview', 'No screenshot captured. The live website was not opened.');
        const indicators = Array.isArray(analysis.detectedCategories) && analysis.detectedCategories.length
          ? analysis.detectedCategories.join(', ')
          : (Array.isArray(analysis.suspiciousPhrases) && analysis.suspiciousPhrases.length
            ? analysis.suspiciousPhrases.map(item => item.phrase).join(', ')
            : 'No configured URL warning patterns matched.');
        setField('sandbox-suspicious-indicators', indicators);
        setField('sandbox-risk-assessment', `Risk score: ${analysis.riskScore}/100 — ${analysis.riskLevel}. ${analysis.riskSummary} ${analysis.uncertaintyDisclaimer || ''}`.trim());

        this.currentAnalysis = analysis;
        this.renderResults(analysis, 'ScamBait Sandbox', url);

        StorageManager.addRecord({
          type: 'ScamBait Sandbox',
          preview: url,
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          badgeClass: analysis.riskBadgeClass,
          details: analysis
        });

        this.showToast('Sandbox URL pattern check complete.', 'success');
      } catch (error) {
        this.showToast(error.message || 'Unable to inspect URL. Please try again.', 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = oldHtml;
      }
    };

    submitBtn.addEventListener('click', inspect);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      inspect();
    });
  },

  /**
   * OPTION C: Screenshot Analyzer
   */
  bindScreenshotUploader() {
    const dropzone = document.getElementById('screenshot-dropzone');
    const fileInput = document.getElementById('screenshot-file-input');
    const browseBtn = document.getElementById('browse-screenshot-btn');
    const previewContainer = document.getElementById('screenshot-preview-container');
    const imagePreview = document.getElementById('screenshot-image-preview');
    const previewImg = document.getElementById('screenshot-preview-img');
    const pdfIndicator = document.getElementById('screenshot-pdf-indicator');
    const fileNameLabel = document.getElementById('screenshot-file-name');
    const fileSizeLabel = document.getElementById('screenshot-file-size');
    const analysisNote = document.getElementById('screenshot-analysis-note');
    const actionLabel = document.getElementById('screenshot-action-label');
    const replaceBtn = document.getElementById('replace-screenshot-btn');
    const removeBtn = document.getElementById('remove-screenshot-btn');
    const submitBtn = document.getElementById('analyze-screenshot-btn');
    const progressWrap = document.getElementById('screenshot-progress-wrap');
    const progressBar = document.getElementById('screenshot-progress-bar');
    const loadSampleBtn = document.getElementById('load-sample-screenshot-btn');

    let currentFile = null;
    let isSampleScreenshot = false;
    const maxImageBytes = 5 * 1024 * 1024;
    const maxPdfBytes = 10 * 1024 * 1024;
    const supportedFormats = {
      '.jpg': { mime: 'image/jpeg', limit: maxImageBytes, label: 'JPG/JPEG' },
      '.jpeg': { mime: 'image/jpeg', limit: maxImageBytes, label: 'JPG/JPEG' },
      '.png': { mime: 'image/png', limit: maxImageBytes, label: 'PNG' },
      '.webp': { mime: 'image/webp', limit: maxImageBytes, label: 'WEBP' },
      '.pdf': { mime: 'application/pdf', limit: maxPdfBytes, label: 'PDF' }
    };

    if (!dropzone || !fileInput) return;

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      fileInput.click();
    });

    dropzone.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
      fileInput.value = '';
      if (file) handleFile(file);
    });

    const formatFileSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} MB`;
    };

    const detectMimeFromSignature = async (file) => {
      const signature = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      const ascii = (start, end) => String.fromCharCode(...signature.slice(start, end));
      if (signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) return 'image/jpeg';
      if (signature.length >= 8 && [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].every((byte, index) => signature[index] === byte)) return 'image/png';
      if (signature.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
      if (ascii(0, signature.length).includes('%PDF-')) return 'application/pdf';
      return '';
    };

    const showSelectedFile = (file, previewUrl = '', sample = false) => {
      currentFile = file;
      isSampleScreenshot = sample;
      const isPdf = !sample && file.type === 'application/pdf';
      fileNameLabel.textContent = file.name;
      fileSizeLabel.textContent = sample ? 'Built-in demonstration' : formatFileSize(file.size);
      pdfIndicator.style.display = isPdf ? 'inline-flex' : 'none';
      imagePreview.style.display = isPdf ? 'none' : 'flex';
      previewImg.src = isPdf ? '' : previewUrl;
      analysisNote.style.display = 'block';
      analysisNote.textContent = isPdf
        ? 'PDF preview only. PDF content analysis is not available.'
        : sample
          ? 'Offline demo: this sample is analysed locally and does not use server OCR.'
          : 'Image OCR requires Tesseract on the server. Image text is submitted for analysis; PDFs remain preview-only.';
      submitBtn.style.display = isPdf ? 'none' : 'inline-flex';
      actionLabel.textContent = sample ? 'Analyse Sample' : 'Analyse Screenshot';
      previewContainer.style.display = 'block';
      dropzone.style.display = 'none';
    };

    const handleFile = async (file) => {
      const extension = file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : '';
      const format = supportedFormats[extension];
      if (!format) {
        this.showToast('Unsupported file format. Choose JPG/JPEG, PNG, WEBP, or PDF.', 'danger', 5000);
        return;
      }
      if ((file.type || '').toLowerCase() !== format.mime) {
        this.showToast(`The selected file's MIME type does not match its .${extension.slice(1)} extension.`, 'danger', 5000);
        return;
      }
      if (file.size > format.limit) {
        const limitMb = format.limit / (1024 * 1024);
        this.showToast(`${format.label} files must be ${limitMb} MB or smaller.`, 'warning', 5000);
        return;
      }

      let actualMime;
      try {
        actualMime = await detectMimeFromSignature(file);
      } catch (_error) {
        this.showToast('Unable to verify this file. Choose a valid JPG/JPEG, PNG, WEBP, or PDF file.', 'danger', 5000);
        return;
      }
      if (actualMime !== format.mime) {
        this.showToast('The file contents do not match a valid file of the selected type.', 'danger', 5000);
        return;
      }

      if (format.mime === 'application/pdf') {
        showSelectedFile(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => showSelectedFile(file, reader.result);
      reader.onerror = () => this.showToast('Unable to preview this image file.', 'danger', 5000);
      reader.readAsDataURL(file);
    };

    replaceBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    removeBtn.addEventListener('click', () => {
      currentFile = null;
      isSampleScreenshot = false;
      fileInput.value = '';
      previewImg.src = '';
      fileNameLabel.textContent = '';
      fileSizeLabel.textContent = '';
      pdfIndicator.style.display = 'none';
      imagePreview.style.display = 'flex';
      analysisNote.style.display = 'none';
      analysisNote.textContent = '';
      submitBtn.style.display = 'none';
      submitBtn.disabled = false;
      actionLabel.textContent = 'Analyse Sample';
      previewContainer.style.display = 'none';
      dropzone.style.display = 'block';
    });

    // Sample Screenshot Generator
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 340;
        const ctx = canvas.getContext('2d');

        // Clean light simulated chat card
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 600, 340);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(0, 0, 600, 60);

        ctx.fillStyle = '#172033';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('+91 98765 43210 (Electricity Dept Support)', 24, 38);

        ctx.fillStyle = '#EFF6FF';
        ctx.beginPath();
        ctx.roundRect(24, 85, 520, 180, 12);
        ctx.fill();

        ctx.fillStyle = '#172033';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText('URGENT: Your electricity power connection will be suspended', 44, 125);
        ctx.fillText('tonight at 9:30 PM due to unverified meter bill update.', 44, 155);
        ctx.fillText('Call Officer Sharma immediately at 9876543210 or install', 44, 185);
        ctx.fillText('QuickSupport APK to prevent disconnection. Do not ignore.', 44, 215);

        ctx.fillStyle = '#64748B';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Today 2:15 PM', 440, 248);

        showSelectedFile({ name: 'Sample chat screenshot.png', size: 0, type: 'image/png' }, canvas.toDataURL('image/png'), true);
        this.showToast('Loaded offline sample screenshot.', 'info');
      });
    }

    // Analyze the built-in demonstration locally; actual uploads use server OCR.
    submitBtn.addEventListener('click', async () => {
      if (isSampleScreenshot) {
        progressWrap.style.display = 'block';
        progressBar.style.width = '20%';
        submitBtn.disabled = true;

        setTimeout(() => { progressBar.style.width = '65%'; }, 300);
        setTimeout(() => { progressBar.style.width = '90%'; }, 600);

        setTimeout(() => {
          progressBar.style.width = '100%';
          setTimeout(() => {
            progressWrap.style.display = 'none';
            submitBtn.disabled = false;

            const extractedText = "URGENT: Your electricity power connection will be suspended tonight at 9:30 PM due to unverified meter bill update. Call Officer Sharma immediately at 9876543210 or install QuickSupport APK to prevent disconnection. Do not ignore.";
            const analysis = SecurityEngine.analyzeConversation(extractedText);

            this.currentAnalysis = analysis;
            this.renderResults(analysis, "Offline Sample Demonstration", extractedText);

            StorageManager.addRecord({
              type: "Screenshot Sample",
              preview: extractedText,
              riskScore: analysis.riskScore,
              riskLevel: analysis.riskLevel,
              badgeClass: analysis.riskBadgeClass,
              details: analysis
            });

            this.showToast('Offline sample demonstration complete (not server OCR).', 'success');
          }, 200);
        }, 850);
        return;
      }

      if (currentFile && currentFile.type === 'application/pdf') {
        this.showToast('PDF files are preview-only. PDF content analysis is not available.', 'warning', 5000);
        return;
      }
      if (!currentFile || !previewImg.src) {
        this.showToast('Please select an image file first.', 'warning');
        return;
      }

      const oldHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Extracting text...';

      try {
        const formData = new FormData();
        formData.append('file', currentFile, currentFile.name);
        const response = await fetch('/api/analyze-screenshot', {
          method: 'POST',
          body: formData
        });
        const analysis = await this.parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(analysis.error || 'Screenshot analysis failed. Please try again.');
        }

        this.currentAnalysis = analysis;
        this.renderResults(analysis, "Screenshot OCR Analysis", analysis.extractedText);
        StorageManager.addRecord({
          type: "Screenshot OCR",
          preview: analysis.extractedText,
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          badgeClass: analysis.riskBadgeClass,
          details: analysis
        });
        this.showToast('Screenshot OCR analysis complete.', 'success');
      } catch (error) {
        this.showToast(error.message || 'Unable to analyze this image. Please try again.', 'danger', 5000);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = oldHtml;
      }
    });
  },

  /**
   * Unified Results Renderer (Easy to Understand for Everyone)
   */
  renderResults(analysis, moduleName, rawInput) {
    const container = document.getElementById('checker-results-container');
    if (!container) return;

    container.style.display = 'block';

    // Risk Level Badge & Score
    const badgeEl = document.getElementById('res-risk-badge');
    badgeEl.className = `badge ${analysis.riskBadgeClass}`;
    const badgeDot = document.createElement('span');
    badgeDot.className = 'badge-dot';
    badgeEl.replaceChildren(badgeDot, document.createTextNode(` ${analysis.riskLevel}`));

    document.getElementById('res-risk-score').textContent = `${analysis.riskScore}/100`;
    document.getElementById('res-category').textContent = analysis.primaryCategory || analysis.detectedCategories?.[0] || 'No known pattern matched';

    // Meter fill
    const fillEl = document.getElementById('res-meter-fill');
    fillEl.style.width = `${analysis.riskScore}%`;
    const meterClass = {
      'badge-critical': 'fill-danger',
      'badge-danger': 'fill-danger',
      'badge-caution': 'fill-caution',
      'badge-safe': 'fill-safe'
    }[analysis.riskBadgeClass] || 'fill-safe';
    fillEl.className = `risk-meter-bar-fill ${meterClass}`;

    document.getElementById('res-summary').textContent = analysis.riskSummary;
    document.getElementById('res-disclaimer').textContent = analysis.uncertaintyDisclaimer;
    const extractedTextWrap = document.getElementById('res-extracted-text-wrap');
    const extractedTextElement = document.getElementById('res-extracted-text');
    if (typeof analysis.extractedText === 'string') {
      extractedTextElement.textContent = analysis.extractedText;
      extractedTextWrap.style.display = 'block';
    } else {
      extractedTextElement.textContent = '';
      extractedTextWrap.style.display = 'none';
    }

    // Warning Signs & Suspicious Phrases
    const warningsList = document.getElementById('res-warning-signs');
    warningsList.replaceChildren();
    if (!analysis.suspiciousPhrases || analysis.suspiciousPhrases.length === 0) {
      const emptyWarning = document.createElement('div');
      emptyWarning.className = 'warning-item';
      emptyWarning.style.borderLeft = '4px solid #16A34A';
      emptyWarning.style.backgroundColor = '#F0FDF4';
      const emptyText = document.createElement('div');
      const emptyTitle = document.createElement('strong');
      emptyTitle.style.color = '#166534';
      emptyTitle.textContent = 'No common warning patterns found';
      const emptyDescription = document.createElement('p');
      emptyDescription.style.cssText = 'font-size: var(--font-xs); color: #15803D; margin-top: 2px;';
      emptyDescription.textContent = 'This does not guarantee that the submitted content is safe.';
      emptyText.append(emptyTitle, emptyDescription);
      emptyWarning.appendChild(emptyText);
      warningsList.appendChild(emptyWarning);
    } else {
      analysis.suspiciousPhrases.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `warning-item ${item.severity === 'danger' ? 'danger' : 'caution'}`;
        const content = document.createElement('div');
        const phrase = document.createElement('strong');
        phrase.style.color = 'var(--text-primary)';
        phrase.textContent = `"${item.phrase}"`;
        const description = document.createElement('p');
        description.style.cssText = 'font-size: var(--font-xs); color: var(--text-secondary); margin-top: 2px;';
        const label = document.createElement('strong');
        label.textContent = 'Warning Sign: ';
        const detail = document.createElement('span');
        detail.textContent = `${item.category || 'Pattern match'}${item.explanation ? ` — ${item.explanation}` : ''}`;
        description.append(label, detail);
        content.append(phrase, description);

        const severity = document.createElement('span');
        severity.className = `badge ${item.severity === 'danger' ? 'badge-danger' : 'badge-caution'}`;
        severity.textContent = item.severity === 'danger' ? 'DANGER' : 'CAUTION';
        itemDiv.append(content, severity);
        warningsList.appendChild(itemDiv);
      });
    }

    // Scam Risk Timeline (Only stages supported by content)
    const timelineContainer = document.getElementById('res-timeline');
    timelineContainer.replaceChildren();
    if (analysis.timeline) {
      analysis.timeline.forEach((step, idx) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = `timeline-step ${step.detected ? 'is-detected' : 'is-absent'}`;
        const bullet = document.createElement('div');
        bullet.className = 'timeline-bullet';
        bullet.textContent = String(idx + 1);
        const header = document.createElement('div');
        header.className = 'timeline-header';
        const title = document.createElement('span');
        title.className = 'timeline-title';
        title.textContent = step.title;
        const status = document.createElement('span');
        status.className = `badge ${step.detected ? 'badge-danger' : 'badge-neutral'}`;
        status.textContent = step.detected ? 'DETECTED' : 'NOT FOUND';
        header.append(title, status);
        const explanation = document.createElement('div');
        explanation.className = 'timeline-desc';
        explanation.textContent = step.explanation;
        stepDiv.append(bullet, header, explanation);
        if (step.detected && step.evidence) {
          const evidence = document.createElement('div');
          evidence.className = 'timeline-quote';
          evidence.textContent = `Found: "${step.evidence}"`;
          stepDiv.appendChild(evidence);
        }
        timelineContainer.appendChild(stepDiv);
      });
    }

    // Recommended Actions
    const recsList = document.getElementById('res-recommendations');
    recsList.innerHTML = '';
    analysis.recommendations.forEach(rec => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.gap = '0.65rem';
      li.style.fontSize = 'var(--font-sm)';
      li.style.marginBottom = '0.5rem';
      li.style.lineHeight = '1.5';
      const icon = document.createElement('span');
      icon.style.cssText = 'color: var(--accent-primary); flex-shrink: 0; margin-top: 2px;';
      icon.innerHTML = ICONS.shieldCheck;
      const recommendation = document.createElement('span');
      recommendation.textContent = rec;
      li.append(icon, recommendation);
      recsList.appendChild(li);
    });

    // Safe Reply Generator
    const repliesContainer = document.getElementById('res-replies');
    repliesContainer.innerHTML = '';
    analysis.suggestedResponses.forEach(reply => {
      const card = document.createElement('div');
      card.className = 'safe-reply-card';
      const replyHeader = document.createElement('div');
      replyHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
      const replyLabel = document.createElement('span');
      replyLabel.style.cssText = 'font-size: var(--font-xs); font-weight: 700; color: var(--text-primary);';
      replyLabel.textContent = reply.label;
      replyHeader.appendChild(replyLabel);
      if (reply.isCopyable) {
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'btn btn-outline btn-sm copy-reply-btn';
        copyButton.style.cssText = 'padding: 0.25rem 0.6rem; font-size: 0.75rem;';
        copyButton.innerHTML = `${ICONS.copy} Copy`;
        replyHeader.appendChild(copyButton);
      }
      const replyText = document.createElement('div');
      replyText.className = 'reply-snippet';
      replyText.textContent = reply.text;
      card.append(replyHeader, replyText);

      if (reply.isCopyable) {
        card.querySelector('.copy-reply-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(reply.text).then(() => {
            this.showToast('Safe response copied to clipboard!', 'success');
          });
        });
      }

      repliesContainer.appendChild(card);
    });

    // Smooth scroll down to results
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  /**
   * My Reports (Local Session / Storage Table)
   */
  renderReportsTable() {
    const tableBody = document.getElementById('reports-table-body');
    const emptyState = document.getElementById('reports-empty-state');
    const clearBtn = document.getElementById('clear-reports-btn');

    if (!tableBody) return;

    const history = StorageManager.getHistory();
    tableBody.replaceChildren();

    if (history.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (clearBtn) clearBtn.disabled = true;
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (clearBtn) clearBtn.disabled = false;

    history.forEach(item => {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      const dateText = document.createElement('span');
      dateText.style.cssText = 'font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);';
      dateText.textContent = item.formattedDate || '';
      dateCell.appendChild(dateText);

      const typeCell = document.createElement('td');
      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge badge-neutral';
      typeBadge.textContent = item.type || 'Text Analysis';
      typeCell.appendChild(typeBadge);

      const previewCell = document.createElement('td');
      previewCell.style.cssText = 'max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-size: var(--font-sm);';
      previewCell.textContent = item.preview || '';

      const riskCell = document.createElement('td');
      const riskBadge = document.createElement('span');
      const allowedBadges = ['badge-safe', 'badge-neutral', 'badge-caution', 'badge-danger', 'badge-critical'];
      riskBadge.className = `badge ${allowedBadges.includes(item.badgeClass) ? item.badgeClass : 'badge-neutral'}`;
      riskBadge.textContent = `${item.riskLevel || 'UNKNOWN'} (${Number.isFinite(item.riskScore) ? item.riskScore : 0})`;
      riskCell.appendChild(riskBadge);

      const actionCell = document.createElement('td');
      actionCell.style.textAlign = 'right';
      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.className = 'btn btn-outline btn-sm view-report-btn';
      viewButton.style.marginRight = '0.5rem';
      viewButton.textContent = 'View';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-ghost btn-sm delete-report-btn';
      deleteButton.title = 'Delete';
      deleteButton.innerHTML = ICONS.trash;
      actionCell.append(viewButton, deleteButton);
      row.append(dateCell, typeCell, previewCell, riskCell, actionCell);

      viewButton.addEventListener('click', () => {
        if (item.details) {
          this.currentAnalysis = item.details;
          window.switchView('view-checker');
          this.renderResults(item.details, item.type, item.preview);
        }
      });

      deleteButton.addEventListener('click', () => {
        if (confirm('Delete this report entry?')) {
          StorageManager.deleteRecord(item.id);
          this.renderReportsTable();
          this.showToast('Report deleted.', 'info');
        }
      });

      tableBody.appendChild(row);
    });

    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Are you sure you want to clear all saved reports from this browser?')) {
          StorageManager.clearAll();
          this.renderReportsTable();
          this.showToast('All reports cleared.', 'info');
        }
      };
    }
  },

  /**
   * Incident Recovery Guidance (1930 Helpline)
   */
  bindRecoveryAssistant() {
    const cards = document.querySelectorAll('.recovery-card-btn');
    const titleEl = document.getElementById('recovery-scenario-title');
    const subtitleEl = document.getElementById('recovery-scenario-subtitle');
    const stepsList = document.getElementById('recovery-steps-list');
    const helplinesContainer = document.getElementById('recovery-helplines-list');

    const renderScenario = (key) => {
      const guidance = RECOVERY_GUIDANCE[key];
      if (!guidance || !titleEl) return;

      titleEl.textContent = guidance.title;
      subtitleEl.textContent = guidance.subtitle;

      stepsList.innerHTML = '';
      guidance.actions.forEach(act => {
        const item = document.createElement('div');
        item.style.backgroundColor = '#FFFFFF';
        item.style.border = '1px solid var(--border-subtle)';
        item.style.borderRadius = 'var(--radius-md)';
        item.style.padding = '1rem 1.25rem';
        item.style.marginBottom = '0.75rem';
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem;">
            <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-primary-subtle); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">${act.step}</span>
            <strong style="font-size: var(--font-sm); color: var(--text-primary);">${act.title}</strong>
          </div>
          <p style="font-size: var(--font-xs); color: var(--text-secondary); margin-left: 2.1rem; line-height: 1.5;">${act.desc}</p>
        `;
        stepsList.appendChild(item);
      });

      helplinesContainer.innerHTML = '';
      guidance.officialHelplines.forEach(hl => {
        const pill = document.createElement('a');
        pill.href = hl.link;
        pill.target = '_blank';
        pill.rel = 'noopener noreferrer';
        pill.className = 'btn btn-outline btn-sm';
        pill.innerHTML = `${ICONS.externalLink} ${hl.name} (${hl.desc})`;
        helplinesContainer.appendChild(pill);
      });
    };

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        renderScenario(card.getAttribute('data-recovery-category'));
      });
    });

    if (cards.length > 0) {
      renderScenario(cards[0].getAttribute('data-recovery-category'));
    }
  },

  /**
   * Report Export Modal
   */
  bindReportModal() {
    const modal = document.getElementById('report-modal');
    const openBtns = document.querySelectorAll('.open-report-modal-btn');
    const closeBtns = document.querySelectorAll('.close-modal-btn');
    const copyBtn = document.getElementById('copy-report-text-btn');
    const downloadBtn = document.getElementById('download-report-btn');
    const printBtn = document.getElementById('print-report-btn');
    const reportPre = document.getElementById('report-modal-content');

    let currentReportObj = null;

    const openModal = () => {
      const targetAnalysis = this.currentAnalysis || SecurityEngine.analyzeConversation(THREAT_PRESETS[0].text);
      currentReportObj = ReportGenerator.generateTextReport(targetAnalysis, "ScamShield Heuristic Audit");
      reportPre.textContent = currentReportObj.text;
      modal.classList.add('is-open');
    };

    const closeModal = () => modal.classList.remove('is-open');

    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (currentReportObj) {
          navigator.clipboard.writeText(currentReportObj.text).then(() => {
            this.showToast('Audit report copied to clipboard!', 'success');
          });
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (currentReportObj) {
          ReportGenerator.downloadReport(`ScamShield_Report_${currentReportObj.reportId}.txt`, currentReportObj.text);
          this.showToast('Downloaded report file.', 'success');
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }
  }
};
