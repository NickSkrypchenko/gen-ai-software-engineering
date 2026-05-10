import { apiClient, type ImportSummary } from './api-client.js';

type DropzoneState = 'idle' | 'hover' | 'uploading' | 'success' | 'error';

export class ImportDropzone {
  private dropzone: HTMLElement;
  private fileInput: HTMLInputElement;
  private formatSelect: HTMLSelectElement;
  private autoClassifyCheckbox: HTMLInputElement;
  private checkboxUi: HTMLElement;
  private state: DropzoneState = 'idle';
  private onComplete?: (summary: ImportSummary) => void;

  constructor(opts: { onComplete?: (summary: ImportSummary) => void } = {}) {
    this.onComplete = opts.onComplete;
    this.dropzone = document.getElementById('import-dropzone')!;
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.formatSelect = document.getElementById('import-format') as HTMLSelectElement;
    this.autoClassifyCheckbox = document.getElementById('import-autoclassify') as HTMLInputElement;
    this.checkboxUi = document.getElementById('import-checkbox-ui')!;

    this.bindEvents();
  }

  private setState(state: DropzoneState): void {
    this.state = state;

    this.dropzone.className = 'dropzone';
    if (state !== 'idle') this.dropzone.classList.add(state);

    const stateIds: DropzoneState[] = ['idle', 'hover', 'uploading', 'success', 'error'];
    stateIds.forEach(s => {
      const el = document.getElementById(`dz-${s}`)!;
      el.style.display = s === state ? 'flex' : 'none';
    });
  }

  private showErrors(errors: ImportSummary['errors']): void {
    const wrap = document.getElementById('import-error-table-wrap')!;
    const tbody = document.getElementById('import-error-tbody')!;
    if (!errors.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    tbody.innerHTML = errors.map(e => `
      <tr>
        <td class="font-mono">${e.rowIndex}</td>
        <td>${e.stage}</td>
        <td>${e.field ?? '—'}</td>
        <td>${e.message}</td>
      </tr>`).join('');
  }

  private async upload(file: File): Promise<void> {
    const format = (this.formatSelect.value || 'csv') as 'csv' | 'json' | 'xml';
    const autoClassify = this.autoClassifyCheckbox.checked;

    this.setState('uploading');
    const progressEl = document.getElementById('dz-progress')!;
    const uploadingText = document.getElementById('dz-uploading-text')!;
    uploadingText.textContent = `Importing ${file.name}…`;

    let progress = 0;
    const tick = setInterval(() => {
      progress = Math.min(progress + 10, 85);
      progressEl.style.width = `${progress}%`;
    }, 200);

    try {
      const summary = await apiClient.importTickets(file, format, autoClassify);
      clearInterval(tick);
      progressEl.style.width = '100%';

      if (summary.failed === 0) {
        this.setState('success');
        const successText = document.getElementById('dz-success-text')!;
        successText.textContent = `${summary.imported} imported · 0 failed`;
        document.getElementById('import-error-table-wrap')?.classList.add('hidden');
      } else {
        this.setState('error');
        const errorText = document.getElementById('dz-error-text')!;
        errorText.textContent = `${summary.imported} imported · ${summary.failed} failed`;
        this.showErrors(summary.errors);
      }

      this.onComplete?.(summary);
    } catch (e: unknown) {
      clearInterval(tick);
      const err = e as Error & { body?: { error?: string } };
      this.setState('error');
      const errorText = document.getElementById('dz-error-text')!;
      errorText.textContent = err.body?.error ?? err.message ?? 'Upload failed';
      this.showErrors([]);
    } finally {
      this.fileInput.value = '';
    }
  }

  private bindEvents(): void {
    // Click to browse
    this.dropzone.addEventListener('click', () => this.fileInput.click());
    this.dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.fileInput.click(); }
    });

    // File selected via picker
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) this.upload(file);
    });

    // Drag events
    this.dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      if (this.state === 'uploading') return;
      this.setState('hover');
    });
    this.dropzone.addEventListener('dragleave', e => {
      if (!this.dropzone.contains(e.relatedTarget as Node)) {
        if (this.state === 'hover') this.setState('idle');
      }
    });
    this.dropzone.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) this.upload(file);
    });

    // Reset buttons
    document.getElementById('dz-reset-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      this.setState('idle');
      document.getElementById('import-error-table-wrap')?.classList.add('hidden');
    });
    document.getElementById('dz-retry-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      this.setState('idle');
      document.getElementById('import-error-table-wrap')?.classList.add('hidden');
    });

    // Custom checkbox toggle
    const toggleCheckbox = () => {
      this.autoClassifyCheckbox.checked = !this.autoClassifyCheckbox.checked;
      const checked = this.autoClassifyCheckbox.checked;
      this.checkboxUi.setAttribute('aria-checked', String(checked));
      const knob = this.checkboxUi.querySelector('span') as HTMLElement;
      knob.style.transform = checked ? 'translateX(16px)' : '';
      this.checkboxUi.style.background = checked ? 'rgba(59,130,246,0.3)' : '';
      this.checkboxUi.style.borderColor = checked ? 'rgba(59,130,246,0.5)' : '';
    };
    this.checkboxUi.addEventListener('click', e => { e.stopPropagation(); toggleCheckbox(); });
    this.checkboxUi.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleCheckbox(); }
    });
  }
}
