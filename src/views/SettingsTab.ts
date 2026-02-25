import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type JournalMonitorPlugin from '../main';
import { JournalConfig, DEFAULT_JOURNALS } from '../types';
import { lookupJournalByIssn } from '../api';

export class JournalMonitorSettingTab extends PluginSettingTab {
  plugin: JournalMonitorPlugin;

  constructor(app: App, plugin: JournalMonitorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: 'Journal Monitor Settings' });

    // Storage locations section
    containerEl.createEl('h2', { text: '📁 Storage Locations' });

    new Setting(containerEl)
      .setName('Saved articles folder')
      .setDesc('Where to save article notes')
      .addText(text => text
        .setPlaceholder('Literature/Journal Articles')
        .setValue(this.plugin.settings.savedArticlesFolder)
        .onChange(async (value) => {
          this.plugin.settings.savedArticlesFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Master index path')
      .setDesc('Path for the master index note')
      .addText(text => text
        .setPlaceholder('Literature/00-Journal-Index.md')
        .setValue(this.plugin.settings.masterIndexPath)
        .onChange(async (value) => {
          this.plugin.settings.masterIndexPath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Journal indices folder')
      .setDesc('Where to save journal-specific index notes')
      .addText(text => text
        .setPlaceholder('Literature/Journals')
        .setValue(this.plugin.settings.journalIndicesFolder)
        .onChange(async (value) => {
          this.plugin.settings.journalIndicesFolder = value;
          await this.plugin.saveSettings();
        }));

    // API settings section
    containerEl.createEl('h2', { text: '🔌 API Settings' });

    new Setting(containerEl)
      .setName('API provider')
      .setDesc('Which API to use for fetching articles')
      .addDropdown(dropdown => dropdown
        .addOption('openalex', 'OpenAlex (recommended)')
        .addOption('crossref', 'CrossRef')
        .setValue(this.plugin.settings.apiProvider)
        .onChange(async (value: 'openalex' | 'crossref') => {
          this.plugin.settings.apiProvider = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Email for API')
      .setDesc('Your email for API requests (improves rate limits, optional but recommended)')
      .addText(text => text
        .setPlaceholder('your.email@example.com')
        .setValue(this.plugin.settings.openAlexEmail || '')
        .onChange(async (value) => {
          this.plugin.settings.openAlexEmail = value;
          this.plugin.settings.crossRefEmail = value;
          await this.plugin.saveSettings();
        }));

    // Sync settings section
    containerEl.createEl('h2', { text: '🔄 Sync Settings' });

    new Setting(containerEl)
      .setName('Fetch on startup')
      .setDesc('Automatically fetch new articles when Obsidian starts')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.fetchOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.fetchOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-fetch frequency')
      .setDesc('How often to automatically fetch new articles')
      .addDropdown(dropdown => dropdown
        .addOption('startup', 'Only on startup')
        .addOption('daily', 'Daily')
        .addOption('weekly', 'Weekly')
        .addOption('manual', 'Manual only')
        .setValue(this.plugin.settings.autoFetchFrequency)
        .onChange(async (value: 'startup' | 'daily' | 'weekly' | 'manual') => {
          this.plugin.settings.autoFetchFrequency = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Articles per fetch')
      .setDesc('Maximum articles to fetch per journal per sync')
      .addSlider(slider => slider
        .setLimits(10, 100, 10)
        .setValue(this.plugin.settings.articlesPerFetch)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.articlesPerFetch = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Lookback period (days)')
      .setDesc('How far back to look for new articles')
      .addSlider(slider => slider
        .setLimits(7, 90, 7)
        .setValue(this.plugin.settings.lookbackDays)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.lookbackDays = value;
          await this.plugin.saveSettings();
        }));

    // Note template settings
    containerEl.createEl('h2', { text: '📝 Note Templates' });

    new Setting(containerEl)
      .setName('Include abstract')
      .setDesc('Include article abstract in saved notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeAbstract)
        .onChange(async (value) => {
          this.plugin.settings.includeAbstract = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Include keywords')
      .setDesc('Include article keywords in frontmatter')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeKeywords)
        .onChange(async (value) => {
          this.plugin.settings.includeKeywords = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Include BibTeX')
      .setDesc('Include BibTeX citation in saved notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeBibtex)
        .onChange(async (value) => {
          this.plugin.settings.includeBibtex = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-tag with journal')
      .setDesc('Automatically add journal name as tag')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoTagWithJournal)
        .onChange(async (value) => {
          this.plugin.settings.autoTagWithJournal = value;
          await this.plugin.saveSettings();
        }));

    // Notifications
    containerEl.createEl('h2', { text: '🔔 Notifications' });

    new Setting(containerEl)
      .setName('Show badge count')
      .setDesc('Show unread article count on ribbon icon')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showBadgeCount)
        .onChange(async (value) => {
          this.plugin.settings.showBadgeCount = value;
          await this.plugin.saveSettings();
          this.plugin.updateRibbonBadge();
        }));

    new Setting(containerEl)
      .setName('Notify on new articles')
      .setDesc('Show notification when new articles are found')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.notifyOnNewArticles)
        .onChange(async (value) => {
          this.plugin.settings.notifyOnNewArticles = value;
          await this.plugin.saveSettings();
        }));

    // Journal subscriptions section
    containerEl.createEl('h2', { text: '📚 Journal Subscriptions' });

    // Add new journal
    const addJournalContainer = containerEl.createDiv({ cls: 'jm-add-journal' });
    
    new Setting(addJournalContainer)
      .setName('Add journal by ISSN')
      .setDesc('Look up and add a new journal')
      .addText(text => {
        text.setPlaceholder('Enter ISSN (e.g., 0378-1127)');
        text.inputEl.addClass('jm-issn-input');
        return text;
      })
      .addButton(button => button
        .setButtonText('Lookup')
        .onClick(async () => {
          const input = addJournalContainer.querySelector('.jm-issn-input') as HTMLInputElement;
          const issn = input?.value.trim();
          
          if (!issn) {
            new Notice('Please enter an ISSN');
            return;
          }
          
          // Check if already exists
          if (this.plugin.settings.journals.some(j => j.issn === issn || j.issnElectronic === issn)) {
            new Notice('Journal already in list');
            return;
          }
          
          new Notice('Looking up journal...');
          
          const journal = await lookupJournalByIssn(issn);
          
          if (journal) {
            this.plugin.settings.journals.push(journal);
            await this.plugin.saveSettings();
            new Notice(`Added: ${journal.name}`);
            this.display(); // Refresh
          } else {
            new Notice('Journal not found. Check the ISSN.');
          }
        }));

    // Journal list
    const journalListEl = containerEl.createDiv({ cls: 'jm-journal-list-settings' });

    for (const journal of this.plugin.settings.journals) {
      const journalSetting = new Setting(journalListEl)
        .setName(journal.name)
        .setDesc(`ISSN: ${journal.issn} | Publisher: ${journal.publisher}`)
        .addToggle(toggle => toggle
          .setValue(journal.enabled)
          .setTooltip('Enable/disable this journal')
          .onChange(async (value) => {
            journal.enabled = value;
            await this.plugin.saveSettings();
          }));

      // Add remove button for non-default journals
      if (!DEFAULT_JOURNALS.some(dj => dj.issn === journal.issn)) {
        journalSetting.addButton(button => button
          .setButtonText('Remove')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.journals = this.plugin.settings.journals.filter(
              j => j.issn !== journal.issn
            );
            await this.plugin.saveSettings();
            this.display(); // Refresh
          }));
      }
    }

    // Data management section
    containerEl.createEl('h2', { text: '🗃️ Data Management' });

    new Setting(containerEl)
      .setName('Clear article cache')
      .setDesc('Remove all fetched articles (saved notes are not affected)')
      .addButton(button => button
        .setButtonText('Clear Cache')
        .setWarning()
        .onClick(async () => {
          if (confirm('Clear all cached articles? This cannot be undone.')) {
            this.plugin.data.articles = {};
            this.plugin.data.browsePosition = { currentDoi: null, filterHash: '', scrollIndex: 0 };
            this.plugin.data.statistics = { totalFetched: 0, totalSaved: 0, totalSkipped: 0, byJournal: {} };
            await this.plugin.saveData(this.plugin.data);
            this.plugin.updateRibbonBadge();
            new Notice('Cache cleared');
          }
        }));

    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to default values')
      .addButton(button => button
        .setButtonText('Reset')
        .setWarning()
        .onClick(async () => {
          if (confirm('Reset all settings to defaults? This cannot be undone.')) {
            await this.plugin.resetSettings();
            this.display(); // Refresh
            new Notice('Settings reset to defaults');
          }
        }));

    // Statistics
    containerEl.createEl('h2', { text: '📊 Statistics' });

    const statsEl = containerEl.createDiv({ cls: 'jm-stats' });
    
    const stats = this.plugin.data.statistics;
    const unseenCount = Object.values(this.plugin.data.articles)
      .filter(a => a.state === 'unseen').length;
    
    statsEl.createEl('p', { text: `Total articles fetched: ${stats.totalFetched}` });
    statsEl.createEl('p', { text: `Unseen articles: ${unseenCount}` });
    statsEl.createEl('p', { text: `Articles saved: ${stats.totalSaved}` });
    statsEl.createEl('p', { text: `Articles skipped: ${stats.totalSkipped}` });
    
    if (this.plugin.data.lastFetch) {
      statsEl.createEl('p', { 
        text: `Last fetch: ${new Date(this.plugin.data.lastFetch).toLocaleString()}` 
      });
    }
  }
}
