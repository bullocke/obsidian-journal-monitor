import { Plugin, Notice, addIcon, TFile, normalizePath } from 'obsidian';
import {
  JournalMonitorSettings,
  JournalMonitorData,
  DEFAULT_SETTINGS,
  DEFAULT_DATA,
  Article,
  FilterConfig,
} from './types';
import { fetchFromOpenAlex, fetchFromCrossRef, backfillAbstracts, getDateRange } from './api';
import { 
  filterArticles, 
  hashFilterConfig, 
  generateMasterIndex, 
  generateJournalIndex,
  ensureFolder 
} from './utils';
import { BrowseView } from './views/BrowseView';
import { DiscoveryView } from './views/DiscoveryView';
import { FilterModal } from './views/FilterModal';
import { JournalMonitorSettingTab } from './views/SettingsTab';

// Custom icon for the ribbon
const JOURNAL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="12" y2="14"></line></svg>`;

export default class JournalMonitorPlugin extends Plugin {
  settings: JournalMonitorSettings;
  data: JournalMonitorData;
  ribbonIconEl: HTMLElement | null = null;
  startupTimeout: number | null = null;
  statusBarItem: HTMLElement | null = null;

  async onload() {
    console.log('Loading Journal Monitor plugin');

    // Register custom icon
    addIcon('journal-monitor', JOURNAL_ICON);

    // Load settings and data
    await this.loadSettings();
    await this.loadPluginData();

    // Add ribbon icon
    this.ribbonIconEl = this.addRibbonIcon(
      'journal-monitor',
      'Journal Monitor',
      () => this.openBrowseView()
    );
    this.updateRibbonBadge();

    // Add settings tab
    this.addSettingTab(new JournalMonitorSettingTab(this.app, this));

    // Register commands
    this.addCommand({
      id: 'open-browse',
      name: 'Open article browser',
      callback: () => this.openBrowseView(),
    });

    this.addCommand({
      id: 'open-discovery',
      name: 'Discovery search',
      callback: () => this.openDiscoveryView(),
    });

    this.addCommand({
      id: 'fetch-articles',
      name: 'Fetch new articles',
      callback: () => this.fetchArticles(),
    });

    this.addCommand({
      id: 'open-filters',
      name: 'Open filters',
      callback: () => this.openFilterModal(),
    });

    this.addCommand({
      id: 'update-master-index',
      name: 'Update master index',
      callback: () => this.updateMasterIndex(),
    });

    this.addCommand({
      id: 'open-master-index',
      name: 'Open master index',
      callback: () => this.openMasterIndex(),
    });

    // Auto-fetch on startup if enabled
    if (this.settings.fetchOnStartup) {
      // Delay to let Obsidian fully load
      this.startupTimeout = window.setTimeout(() => this.checkAndFetch(), 5000);
    }

    // Add status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar(this.statusBarItem);
  }

  onunload() {
    console.log('Unloading Journal Monitor plugin');
    if (this.startupTimeout !== null) {
      window.clearTimeout(this.startupTimeout);
    }
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded?.settings || {});
    
    // Ensure journals array exists and merge with defaults
    if (!this.settings.journals || this.settings.journals.length === 0) {
      this.settings.journals = DEFAULT_SETTINGS.journals;
    }
  }

  async loadPluginData() {
    const loaded = await this.loadData();
    this.data = Object.assign({}, DEFAULT_DATA, loaded?.data || {});
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      data: this.data,
    });
  }

  async savePluginData() {
    await this.saveData({
      settings: this.settings,
      data: this.data,
    });
  }

  async resetSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    await this.saveSettings();
  }

  updateRibbonBadge() {
    if (!this.ribbonIconEl) return;

    // Remove existing badge
    const existingBadge = this.ribbonIconEl.querySelector('.jm-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    if (!this.settings.showBadgeCount) return;

    // Count unseen articles
    const unseenCount = Object.values(this.data.articles)
      .filter(a => a.state === 'unseen').length;

    if (unseenCount > 0) {
      const badge = this.ribbonIconEl.createSpan({ cls: 'jm-badge' });
      badge.setText(unseenCount > 99 ? '99+' : String(unseenCount));
    }
  }

  updateStatusBar(statusBarItem: HTMLElement) {
    const unseenCount = Object.values(this.data.articles)
      .filter(a => a.state === 'unseen').length;

    if (unseenCount > 0) {
      statusBarItem.setText(`📚 ${unseenCount} new articles`);
    } else {
      statusBarItem.setText('📚 No new articles');
    }
  }

  openBrowseView() {
    const modal = new BrowseView(
      this.app,
      this.settings,
      this.data,
      () => {
        this.savePluginData();
        if (this.statusBarItem) {
          this.updateStatusBar(this.statusBarItem);
        }
      },
      () => this.openFilterModal()
    );
    modal.open();
  }

  openDiscoveryView() {
    const modal = new DiscoveryView(
      this.app,
      this.settings,
      this.data,
      () => this.savePluginData()
    );
    modal.open();
  }

  openFilterModal() {
    const articleCount = filterArticles(
      Object.values(this.data.articles),
      this.settings.currentFilter,
      this.settings.journals.filter(j => j.enabled)
    ).length;

    const modal = new FilterModal(
      this.app,
      this.settings,
      articleCount,
      async (filter: FilterConfig) => {
        this.settings.currentFilter = filter;
        this.data.browsePosition.filterHash = hashFilterConfig(filter);
        this.data.browsePosition.scrollIndex = 0;
        await this.saveSettings();
        this.openBrowseView();
      }
    );
    modal.open();
  }

  async checkAndFetch() {
    const now = new Date();
    const lastFetch = this.data.lastFetch ? new Date(this.data.lastFetch) : null;

    let shouldFetch = false;

    switch (this.settings.autoFetchFrequency) {
      case 'startup':
        shouldFetch = true;
        break;
      case 'daily':
        if (!lastFetch || (now.getTime() - lastFetch.getTime()) > 24 * 60 * 60 * 1000) {
          shouldFetch = true;
        }
        break;
      case 'weekly':
        if (!lastFetch || (now.getTime() - lastFetch.getTime()) > 7 * 24 * 60 * 60 * 1000) {
          shouldFetch = true;
        }
        break;
      case 'manual':
        shouldFetch = false;
        break;
    }

    if (shouldFetch) {
      await this.fetchArticles();
    }
  }

  async fetchArticles() {
    const enabledJournals = this.settings.journals.filter(j => j.enabled);
    
    if (enabledJournals.length === 0) {
      new Notice('No journals enabled. Enable journals in settings.');
      return;
    }

    new Notice(`Fetching articles from ${enabledJournals.length} journals...`);

    const { from, to } = getDateRange('custom', 
      this.getDateDaysAgo(this.settings.lookbackDays),
      new Date().toISOString().split('T')[0]
    );

    let newArticleCount = 0;
    let totalFetched = 0;

    for (const journal of enabledJournals) {
      try {
        let articles: Article[];

        if (this.settings.apiProvider === 'openalex') {
          articles = await fetchFromOpenAlex(
            journal,
            from,
            to,
            this.settings.articlesPerFetch,
            this.settings.openAlexEmail
          );
        } else {
          articles = await fetchFromCrossRef(
            journal,
            from,
            to,
            this.settings.articlesPerFetch,
            this.settings.crossRefEmail
          );
        }

        totalFetched += articles.length;

        for (const article of articles) {
          if (!this.data.articles[article.doi]) {
            this.data.articles[article.doi] = article;
            newArticleCount++;

            // Update journal stats
            if (!this.data.statistics.byJournal[journal.issn]) {
              this.data.statistics.byJournal[journal.issn] = { fetched: 0, saved: 0, skipped: 0 };
            }
            this.data.statistics.byJournal[journal.issn].fetched++;
          }
        }

      } catch (error) {
        console.error(`Error fetching from ${journal.name}:`, error);
      }
    }

    this.data.lastFetch = new Date().toISOString();
    this.data.statistics.totalFetched += newArticleCount;

    // Backfill missing abstracts from CrossRef (OpenAlex often lacks them for paywalled journals)
    if (newArticleCount > 0 && this.settings.apiProvider === 'openalex') {
      const newArticles = Object.values(this.data.articles).filter(a => !a.abstract && a.fetchedAt === this.data.lastFetch);
      if (newArticles.length > 0) {
        const filled = await backfillAbstracts(newArticles);
        if (filled > 0) {
          console.log(`Journal Monitor: Backfilled ${filled} abstracts from CrossRef`);
        }
      }
    }

    await this.savePluginData();
    this.updateRibbonBadge();
    
    if (this.statusBarItem) {
      this.updateStatusBar(this.statusBarItem);
    }

    if (this.settings.notifyOnNewArticles && newArticleCount > 0) {
      new Notice(`Found ${newArticleCount} new articles!`);
    } else if (newArticleCount === 0) {
      new Notice('No new articles found.');
    }
  }

  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  async updateMasterIndex() {
    const articles = Object.values(this.data.articles);
    const content = generateMasterIndex(articles, this.settings);
    
    const indexPath = normalizePath(this.settings.masterIndexPath);
    const folderPath = indexPath.substring(0, indexPath.lastIndexOf('/'));
    
    if (folderPath) {
      await ensureFolder(this.app, folderPath);
    }

    const existingFile = this.app.vault.getAbstractFileByPath(indexPath);
    
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(indexPath, content);
    }

    new Notice('Master index updated');
  }

  async openMasterIndex() {
    const indexPath = normalizePath(this.settings.masterIndexPath);
    const file = this.app.vault.getAbstractFileByPath(indexPath);

    if (file instanceof TFile) {
      await this.app.workspace.getLeaf().openFile(file);
    } else {
      await this.updateMasterIndex();
      const newFile = this.app.vault.getAbstractFileByPath(indexPath);
      if (newFile instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(newFile);
      }
    }
  }

  async updateJournalIndex(journalIssn: string) {
    const journal = this.settings.journals.find(j => j.issn === journalIssn);
    if (!journal) return;

    const articles = Object.values(this.data.articles);
    const content = generateJournalIndex(journal, articles);
    
    const journalSlug = journal.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const folderPath = normalizePath(this.settings.journalIndicesFolder);
    const indexPath = normalizePath(`${folderPath}/${journalSlug}.md`);
    
    await ensureFolder(this.app, folderPath);

    const existingFile = this.app.vault.getAbstractFileByPath(indexPath);
    
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(indexPath, content);
    }
  }
}
