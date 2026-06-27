import { defineConfig } from 'vitepress';

/** Published on /docs/ — only quick start, API, and MCP. Other *.md files remain in repo for GitHub. */
const unpublished = [
  'admin-guide.md',
  'api-interactive.md',
  'backup.md',
  'brevo-setup.md',
  'deploy.md',
  'mailsink-comparison.md',
  'security.md',
  'testing.md',
  'user-auth.md',
];

export default defineConfig({
  lang: 'zh-CN',
  title: 'zMailR 文档',
  description: '临时邮箱与 OTP 自动化 — 快速开始、API、MCP',
  base: '/docs/',
  outDir: '../frontend/public/docs',
  cleanUrls: true,
  srcExclude: unpublished.map((f) => `**/${f}`),
  ignoreDeadLinks: [
    /^\/mcp\.json\.example$/,
    /^\.\/mcp\.json\.example$/,
    /^\/login$/,
    /^\/dashboard\//,
    /^\/api-docs$/,
    /^\/openapi\.json$/,
  ],
  rewrites: {
    'README.md': 'index.md',
  },
  lastUpdated: true,
  appearance: true,
  head: [
    [
      'script',
      {},
      `(function(){try{var k='theme',v='vitepress-theme-appearance',a=localStorage.getItem(k),t=a;if(a!=='dark'&&a!=='light'){var p=localStorage.getItem(v);t=(p==='dark'||p==='light')?p:'dark';localStorage.setItem(k,t);localStorage.setItem(v,t)}document.documentElement.classList.remove('dark','light');document.documentElement.classList.add(t)}catch(e){}})();`,
    ],
  ],
  themeConfig: {
    siteTitle: 'zMailR',

    nav: [
      { text: '控制台', link: '../../dashboard/usage', target: '_self', rel: undefined },
      { text: 'GitHub', link: 'https://github.com/jia0327/zmailr' },
    ],

    sidebar: [
      { text: '快速开始', link: '/' },
      { text: 'API 详解', link: '/api' },
      { text: 'MCP 详解', link: '/mcp' },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/jia0327/zmailr' }],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            displayDetails: '显示详细列表',
            resetButtonTitle: '清除查询条件',
            backButtonTitle: '关闭搜索',
            noResultsText: '无法找到相关结果',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },

    footer: {
      message: 'zMailR — 开源临时邮箱与 OTP 自动化',
      copyright: 'Copyright © 2024-present zMailR contributors',
    },

    outline: { label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '返回顶部',
  },
});
