/**
 * ZenTree Tabs - Theme settings and application (color scheme, theme class).
 */
export class Theme {
  constructor() {}

  async updateThemeSettings(partialSettings) {
    const res = await chrome.storage.local.get({
      themeSettings: { themeColor: 'minimal-blue', colorScheme: 'system' },
    });
    const newSettings = { ...res.themeSettings, ...partialSettings };
    await chrome.storage.local.set({ themeSettings: newSettings });
  }

  async applyTheme() {
    const res = await chrome.storage.local.get({
      themeSettings: {
        themeColor: 'minimal-blue',
        colorScheme: 'system',
      },
    });
    const settings = res.themeSettings;

    const colorScheme = settings.colorScheme || 'system';
    const root = document.documentElement;

    if (colorScheme === 'light') {
      root.classList.add('force-light');
      root.classList.remove('force-dark');
    } else if (colorScheme === 'dark') {
      root.classList.add('force-dark');
      root.classList.remove('force-light');
    } else {
      root.classList.remove('force-light', 'force-dark');
    }

    if (settings.themeColor === 'minimal-amoled') {
      root.classList.add('force-dark');
      root.classList.remove('force-light');
    }

    document.body.classList.add('no-mesh');
    document.body.classList.add('flat-tabs');

    document.body.classList.remove(
      'theme-minimal-blue',
      'theme-minimal-slate',
      'theme-minimal-sage',
      'theme-minimal-rose',
      'theme-minimal-amber',
      'theme-minimal-indigo',
      'theme-minimal-teal',
      'theme-minimal-charcoal',
      'theme-minimal-amoled'
    );

    if (settings.themeColor) {
      document.body.classList.add(`theme-${settings.themeColor}`);
    }
  }
}
