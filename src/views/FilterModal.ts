import { App, Modal, setIcon } from 'obsidian';
import { FilterConfig, JournalMonitorSettings } from '../types';
import { hashFilterConfig } from '../utils';

export class FilterModal extends Modal {
  private settings: JournalMonitorSettings;
  private filter: FilterConfig;
  private onApply: (filter: FilterConfig) => void;
  private articleCount: number;
  
  constructor(
    app: App,
    settings: JournalMonitorSettings,
    articleCount: number,
    onApply: (filter: FilterConfig) => void
  ) {
    super(app);
    this.settings = settings;
    this.filter = { ...settings.currentFilter };
    this.onApply = onApply;
    this.articleCount = articleCount;
  }
  
  onOpen() {
    const { contentEl } = this;
    
    contentEl.addClass('journal-monitor-filter');
    contentEl.empty();
    
    // Header
    const header = contentEl.createDiv({ cls: 'jm-filter-header' });
    header.createEl('span', { text: 'Filters', cls: 'jm-filter-title' });
    
    const closeBtn = header.createEl('button', { cls: 'jm-header-btn' });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', () => this.close());
    
    // Date range section
    const dateSection = contentEl.createDiv({ cls: 'jm-filter-section' });
    dateSection.createEl('h4', { text: '📅 Date Range' });
    
    const dateOptions = dateSection.createDiv({ cls: 'jm-filter-options' });
    
    const dateRanges: { value: FilterConfig['dateRange']; label: string }[] = [
      { value: 'day', label: 'Last 24 hours' },
      { value: 'week', label: 'Last 7 days' },
      { value: 'month', label: 'Last 30 days' },
      { value: '3months', label: 'Last 3 months' },
      { value: 'custom', label: 'Custom range...' },
    ];
    
    for (const range of dateRanges) {
      const label = dateOptions.createEl('label', { cls: 'jm-radio-label' });
      const input = label.createEl('input', { type: 'radio' });
      input.name = 'date-range';
      input.value = range.value;
      input.checked = this.filter.dateRange === range.value;
      input.addEventListener('change', () => {
        this.filter.dateRange = range.value;
        customDateContainer.toggleClass('jm-hidden', range.value !== 'custom');
      });
      label.appendText(` ${range.label}`);
    }
    
    // Custom date inputs
    const customDateContainer = dateSection.createDiv({ cls: 'jm-custom-date' });
    if (this.filter.dateRange !== 'custom') {
      customDateContainer.addClass('jm-hidden');
    }
    
    const fromInput = customDateContainer.createEl('input', { type: 'date' });
    fromInput.value = this.filter.customDateFrom || '';
    fromInput.addEventListener('change', (e) => {
      this.filter.customDateFrom = (e.target as HTMLInputElement).value;
    });
    
    customDateContainer.createEl('span', { text: ' to ' });
    
    const toInput = customDateContainer.createEl('input', { type: 'date' });
    toInput.value = this.filter.customDateTo || '';
    toInput.addEventListener('change', (e) => {
      this.filter.customDateTo = (e.target as HTMLInputElement).value;
    });
    
    // Journals section
    const journalSection = contentEl.createDiv({ cls: 'jm-filter-section' });
    journalSection.createEl('h4', { text: '📚 Journals' });
    
    const journalList = journalSection.createDiv({ cls: 'jm-filter-journal-list' });
    
    for (const journal of this.settings.journals.filter(j => j.enabled)) {
      const label = journalList.createEl('label', { cls: 'jm-checkbox-label' });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      checkbox.checked = this.filter.journals.length === 0 || 
                         this.filter.journals.includes(journal.issn);
      checkbox.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) {
          if (!this.filter.journals.includes(journal.issn)) {
            this.filter.journals.push(journal.issn);
          }
        } else {
          this.filter.journals = this.filter.journals.filter(i => i !== journal.issn);
        }
      });
      label.appendText(` ${journal.name}`);
    }
    
    const journalActions = journalSection.createDiv({ cls: 'jm-filter-actions-small' });
    
    const selectAllBtn = journalActions.createEl('button', { text: 'Select All', cls: 'jm-btn-small' });
    selectAllBtn.addEventListener('click', () => {
      this.filter.journals = this.settings.journals.filter(j => j.enabled).map(j => j.issn);
      journalList.querySelectorAll('input[type="checkbox"]').forEach((cb: HTMLInputElement) => {
        cb.checked = true;
      });
    });
    
    const selectNoneBtn = journalActions.createEl('button', { text: 'None', cls: 'jm-btn-small' });
    selectNoneBtn.addEventListener('click', () => {
      this.filter.journals = [];
      journalList.querySelectorAll('input[type="checkbox"]').forEach((cb: HTMLInputElement) => {
        cb.checked = false;
      });
    });
    
    // Keywords section
    const keywordSection = contentEl.createDiv({ cls: 'jm-filter-section' });
    keywordSection.createEl('h4', { text: '🔍 Keywords (match any)' });
    
    const keywordInput = keywordSection.createEl('input', {
      type: 'text',
      placeholder: 'biomass, lidar, forest',
      cls: 'jm-filter-input'
    });
    keywordInput.value = this.filter.keywords.join(', ');
    keywordInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.filter.keywords = value.split(',').map(k => k.trim()).filter(k => k);
    });
    
    const searchInLabel = keywordSection.createEl('label', { cls: 'jm-checkbox-label' });
    const searchInCheckbox = searchInLabel.createEl('input', { type: 'checkbox' });
    searchInCheckbox.checked = this.filter.searchInAbstracts;
    searchInCheckbox.addEventListener('change', (e) => {
      this.filter.searchInAbstracts = (e.target as HTMLInputElement).checked;
    });
    searchInLabel.appendText(' Search in titles + abstracts');
    
    // Article status section
    const statusSection = contentEl.createDiv({ cls: 'jm-filter-section' });
    statusSection.createEl('h4', { text: '📊 Article Status' });
    
    const statusOptions = statusSection.createDiv({ cls: 'jm-filter-options' });
    
    const statuses: { value: FilterConfig['showState']; label: string }[] = [
      { value: 'unseen', label: 'Show unseen only' },
      { value: 'all', label: 'Show all (incl. viewed)' },
      { value: 'saved', label: 'Show saved only' },
      { value: 'skipped', label: 'Show skipped only' },
    ];
    
    for (const status of statuses) {
      const label = statusOptions.createEl('label', { cls: 'jm-radio-label' });
      const input = label.createEl('input', { type: 'radio' });
      input.name = 'status';
      input.value = status.value;
      input.checked = this.filter.showState === status.value;
      input.addEventListener('change', () => {
        this.filter.showState = status.value;
      });
      label.appendText(` ${status.label}`);
    }
    
    // Sort section
    const sortSection = contentEl.createDiv({ cls: 'jm-filter-section' });
    sortSection.createEl('h4', { text: '🔢 Sort By' });
    
    const sortOptions = sortSection.createDiv({ cls: 'jm-filter-options' });
    
    const sorts: { value: FilterConfig['sortBy']; label: string }[] = [
      { value: 'date-desc', label: 'Publication date (newest)' },
      { value: 'date-asc', label: 'Publication date (oldest)' },
      { value: 'journal', label: 'Journal name' },
    ];
    
    for (const sort of sorts) {
      const label = sortOptions.createEl('label', { cls: 'jm-radio-label' });
      const input = label.createEl('input', { type: 'radio' });
      input.name = 'sort';
      input.value = sort.value;
      input.checked = this.filter.sortBy === sort.value;
      input.addEventListener('change', () => {
        this.filter.sortBy = sort.value;
      });
      label.appendText(` ${sort.label}`);
    }
    
    // Action buttons
    const actions = contentEl.createDiv({ cls: 'jm-filter-actions' });
    
    const applyBtn = actions.createEl('button', { 
      text: `Apply Filters (${this.articleCount})`,
      cls: 'jm-btn-primary'
    });
    applyBtn.addEventListener('click', () => {
      this.onApply(this.filter);
      this.close();
    });
  }
  
  onClose() {
    this.contentEl.empty();
  }
}
