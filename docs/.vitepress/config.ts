import { defineConfig } from 'vitepress'

const enNav = [
  { text: 'Guide', link: '/guide/installation' },
  { text: 'Reference', link: '/reference/commands' },
  { text: 'Architecture', link: '/architecture' },
]

const zhNav = [
  { text: '指南', link: '/zh/guide/installation' },
  { text: '参考', link: '/zh/reference/commands' },
  { text: '架构', link: '/zh/architecture' },
]

const enSidebar = {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Installation', link: '/guide/installation' },
        { text: 'Configuration', link: '/guide/configuration' },
        { text: 'Quick Start', link: '/guide/quick-start' },
      ],
    },
  ],
  '/reference/': [
    {
      text: 'Reference',
      items: [
        { text: 'Commands', link: '/reference/commands' },
        { text: 'Tools', link: '/reference/tools' },
      ],
    },
  ],
}

const zhSidebar = {
  '/zh/guide/': [
    {
      text: '指南',
      items: [
        { text: '安装说明', link: '/zh/guide/installation' },
        { text: '配置说明', link: '/zh/guide/configuration' },
        { text: '快速开始', link: '/zh/guide/quick-start' },
      ],
    },
  ],
  '/zh/reference/': [
    {
      text: '参考',
      items: [
        { text: '命令参考', link: '/zh/reference/commands' },
        { text: '工具参考', link: '/zh/reference/tools' },
      ],
    },
  ],
}

export default defineConfig({
  srcDir: '.',
  base: '/clawneo/',
  lang: 'en-US',
  title: 'ClawNeo',
  description: 'Personal AI assistant CLI with a Discord bridge',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/clawneo/assets/favicon.ico' }],
    ['link', { rel: 'alternate icon', type: 'image/png', href: '/clawneo/assets/favicon-32x32.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/clawneo/assets/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
  ],
  themeConfig: {
    logo: '/assets/clawneo-icon-512.png',
    socialLinks: [{ icon: 'github', link: 'https://github.com/Tit1e/clawneo' }],
    outline: { level: [2, 3], label: 'On this page' },
    search: { provider: 'local' },
    footer: {
      message: 'MIT Licensed',
      copyright: 'Copyright © 2026 Tit1e',
    },
    nav: enNav,
    sidebar: enSidebar,
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'ClawNeo',
      description: 'Personal AI assistant CLI with a Discord bridge',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'ClawNeo',
      description: '面向 Discord 优先工作流的个人 AI 助手 CLI',
      link: '/zh/',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
      },
    },
  },
})
