# Journal Monitor

A TikTok-style browser for academic journal articles in Obsidian. Stay current with the latest research by swiping through articles from your favorite journals, saving interesting papers directly to your vault with full metadata and BibTeX citations.

![Obsidian](https://img.shields.io/badge/Obsidian-1.0+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 📱 TikTok-Style Article Browser
- **Swipe/arrow navigation** through articles one at a time
- **Full article cards** with title, authors, abstract, journal, date, DOI
- **Keyboard shortcuts**: `j`/`k` or `↑`/`↓` to navigate, `s` to save, `x` to skip, `Enter` to open
- **Touch support** for mobile: swipe up/down to navigate, left/right to skip/save
- **State persistence** - resume exactly where you left off

### 🔍 Discovery Search
- **Search historical articles** by keyword across all your subscribed journals
- **Custom date ranges** - search articles from any time period
- **Powered by OpenAlex** - comprehensive academic database
- **Save directly** from search results

### 📚 Journal Subscriptions
Pre-configured with major journals:
- Remote Sensing of Environment
- Global Change Biology
- Nature Climate Change
- Nature Sustainability
- Biogeosciences
- ISPRS J. Photogrammetry & Remote Sensing
- And more...

**Add custom journals** by ISSN - automatic lookup via OpenAlex.

### 💾 Smart Note Generation
Saved articles automatically create notes with:
- **YAML frontmatter**: title, authors, journal, DOI, date, keywords, tags
- **Formatted body**: metadata, abstract, notes section
- **BibTeX citation** ready for your reference manager
- **Auto-tagging** by journal name and "unread" status

### 📊 Index & Organization
- **Master index**: aggregated view of all saved articles with Dataview queries
- **Journal indices**: per-journal article lists
- **Statistics**: track your reading progress

### 🔄 Automatic Syncing
- **Fetch on startup** or manual refresh
- **Configurable lookback period** (7-90 days)
- **Badge notifications** showing unread count

## Installation

### From Source (Development)

1. Clone this repository into your vault's plugins folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins
   git clone https://github.com/bullocke/obsidian-journal-monitor
   cd obsidian-journal-monitor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Enable the plugin in Obsidian Settings → Community Plugins

### Development Mode

For active development with hot reload:
```bash
npm run dev
```

## Usage

### Quick Start

1. **Enable journals** you want to follow in Settings → Journal Monitor → Journal Subscriptions
2. **Add your email** (optional but recommended) for better API rate limits
3. **Click the ribbon icon** (📚) or use command palette: "Journal Monitor: Open article browser"
4. **Navigate** with arrow keys or swipe gestures
5. **Save** interesting articles with `s` key or Save button
6. **Skip** articles you're not interested in with `x` key

### Commands

| Command | Description |
|---------|-------------|
| `Open article browser` | Main TikTok-style browser |
| `Discovery search` | Search historical articles by keyword |
| `Fetch new articles` | Manually fetch latest articles |
| `Open filters` | Configure browse filters |
| `Update master index` | Regenerate the master index note |
| `Open master index` | Navigate to master index |

### Keyboard Shortcuts (Browse View)

| Key | Action |
|-----|--------|
| `↓` or `j` | Next article |
| `↑` or `k` | Previous article |
| `s` | Save article |
| `x` | Skip article |
| `Enter` | Open article URL |
| `f` | Open filters |
| `Esc` | Close browser |

### Mobile Gestures

| Gesture | Action |
|---------|--------|
| Swipe up | Next article |
| Swipe down | Previous article |
| Swipe left | Skip article |
| Swipe right | Save article |
| Tap title | Open article URL |

## Settings

### Storage Locations
- **Saved articles folder**: Where article notes are created (default: `Literature/Journal Articles`)
- **Master index path**: Location of the master index (default: `Literature/00-Journal-Index.md`)
- **Journal indices folder**: Per-journal index notes (default: `Literature/Journals`)

### API Settings
- **API provider**: OpenAlex (recommended) or CrossRef
- **Email**: Your email for API requests (improves rate limits)

### Sync Settings
- **Fetch on startup**: Automatically check for new articles
- **Auto-fetch frequency**: startup/daily/weekly/manual
- **Articles per fetch**: 10-100 per journal
- **Lookback period**: 7-90 days

### Note Templates
- **Include abstract**: Add abstract to saved notes
- **Include keywords**: Add keywords to frontmatter
- **Include BibTeX**: Add BibTeX citation block
- **Auto-tag with journal**: Add journal name as tag

## API Information

This plugin uses free, open APIs:

### OpenAlex (Default)
- **Rate limit**: 100,000 requests/day (with email), 10/second
- **Coverage**: Comprehensive, good abstract availability
- **Documentation**: [docs.openalex.org](https://docs.openalex.org)

### CrossRef (Alternative)
- **Rate limit**: Unlimited with polite pool (mailto parameter)
- **Coverage**: Good for DOIs, abstracts may be limited
- **Documentation**: [api.crossref.org](https://api.crossref.org)

## File Structure

```
journal-monitor/
├── src/
│   ├── main.ts           # Plugin entry point
│   ├── types.ts          # TypeScript types & defaults
│   ├── api.ts            # OpenAlex/CrossRef API integration
│   ├── utils.ts          # Utility functions (note generation, filtering)
│   └── views/
│       ├── BrowseView.ts      # TikTok-style browser modal
│       ├── DiscoveryView.ts   # Search/discovery modal
│       ├── FilterModal.ts     # Filter configuration modal
│       └── SettingsTab.ts     # Settings tab
├── styles.css            # Plugin styles
├── manifest.json         # Obsidian plugin manifest
├── package.json          # NPM dependencies
├── tsconfig.json         # TypeScript configuration
├── esbuild.config.mjs    # Build configuration
└── README.md             # This file
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Zotero integration for saved articles
- [ ] RSS feed support for journals without API coverage
- [ ] Article recommendations based on saved papers
- [ ] Collaborative reading lists
- [ ] Export to other reference managers
- [ ] Custom note templates
- [ ] Integration with Obsidian's graph view

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [OpenAlex](https://openalex.org/) for their excellent open academic API
- [CrossRef](https://www.crossref.org/) for DOI metadata
- [Obsidian](https://obsidian.md/) for the amazing knowledge base platform
