import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'zMailR 文档',
  description: '开源、可自托管的 24 小时临时邮箱与 OTP 自动化平台',
  base: '/docs/',
  outDir: '../frontend/public/docs',
  cleanUrls: false,
  // README.md is the doc hub; map it to index so /docs/ gets index.html + correct client route
  rewrites: {
    'README.md': 'index.md',
  },
  lastUpdated: true,
  appearance: true,
  // Links to repo root (README, packages/mcp) are intentional in source markdown
  ignoreDeadLinks: [/\.\.\/README/, /\.\.\/packages\/mcp\/README/],

  themeConfig: {
    siteTitle: 'zMailR',

    nav: [
      // Paths outside /docs/ base — use relative escape so VitePress does not prefix base + .html
      { text: '控制台', link: '../../dashboard/usage', target: '_self', rel: undefined },
      { text: 'API 交互文档', link: '../../api-docs', target: '_self', rel: undefined },
      { text: 'GitHub', link: 'https://github.com/jia0327/zmailr' },
    ],

    sidebar: [
      {
        text: '入门',
        items: [
          { text: '快速开始', link: '/' },
          { text: 'API 速通', link: '/#api-速通' },
          { text: '自托管部署', link: '/deploy' },
          { text: '部署指南', link: '/deploy' },
          { text: '认证', link: '/user-auth' },
          { text: '速率限制', link: '/api#速率限制' },
        ],
      },
      {
        text: 'API 参考',
        items: [
          { text: '端点一览', link: '/api' },
          { text: '用户认证与 Token', link: '/user-auth' },
          { text: 'API 交互文档', link: '../../api-docs', target: '_self', rel: undefined },
          { text: 'OpenAPI', link: '/openapi.json', target: '_blank', rel: 'noopener noreferrer' },
        ],
      },
      {
        text: 'MCP',
        items: [{ text: 'MCP 集成', link: '/mcp' }],
      },
      {
        text: '部署与运维',
        items: [
          { text: '部署指南', link: '/deploy' },
          { text: 'D1 备份', link: '/backup' },
          { text: '管理后台', link: '/admin-guide' },
        ],
      },
      {
        text: '集成',
        items: [{ text: 'Brevo 发信', link: '/brevo-setup' }],
      },
      {
        text: '参考',
        items: [
          { text: 'OpenAPI 规范', link: '/openapi.json', target: '_blank', rel: 'noopener noreferrer' },
          { text: 'E2E 测试报告', link: '/testing' },
          { text: '与 MailSink 对照', link: '/mailsink-comparison' },
        ],
      },
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
