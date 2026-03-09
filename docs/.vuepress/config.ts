import { defaultTheme } from '@vuepress/theme-default'
import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'

export default defineUserConfig({
  base: '/clawneo/',
  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/clawneo/assets/favicon.ico' }],
    ['link', { rel: 'alternate icon', type: 'image/png', href: '/clawneo/assets/favicon-32x32.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/clawneo/assets/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
  ],
  locales: {
    '/': {
      lang: 'en-US',
      title: 'ClawNeo',
      description: 'Personal AI assistant CLI with a Discord bridge',
    },
    '/zh/': {
      lang: 'zh-CN',
      title: 'ClawNeo',
      description: '面向 Discord 优先工作流的个人 AI 助手 CLI',
    },
  },
  theme: defaultTheme({
    logo: '/assets/clawneo-icon-512.png',
    repo: 'Tit1e/clawneo',
    docsDir: 'docs',
    locales: {
      '/': {
        selectLanguageName: 'English',
        selectLanguageText: 'Languages',
        navbar: [
          { text: 'Guide', link: '/guide/installation.html' },
          { text: 'Reference', link: '/reference/commands.html' },
          { text: 'Architecture', link: '/architecture.html' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guide',
              children: [
                '/guide/installation.md',
                '/guide/configuration.md',
                '/guide/quick-start.md',
              ],
            },
          ],
          '/reference/': [
            {
              text: 'Reference',
              children: ['/reference/commands.md', '/reference/tools.md'],
            },
          ],
          '/': [
            '/',
            '/guide/installation.md',
            '/guide/configuration.md',
            '/guide/quick-start.md',
            '/reference/commands.md',
            '/reference/tools.md',
            '/architecture.md',
          ],
        },
      },
      '/zh/': {
        selectLanguageName: '简体中文',
        selectLanguageText: '选择语言',
        navbar: [
          { text: '指南', link: '/zh/guide/installation.html' },
          { text: '参考', link: '/zh/reference/commands.html' },
          { text: '架构', link: '/zh/architecture.html' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '指南',
              children: [
                '/zh/guide/installation.md',
                '/zh/guide/configuration.md',
                '/zh/guide/quick-start.md',
              ],
            },
          ],
          '/zh/reference/': [
            {
              text: '参考',
              children: ['/zh/reference/commands.md', '/zh/reference/tools.md'],
            },
          ],
          '/zh/': [
            '/zh/',
            '/zh/guide/installation.md',
            '/zh/guide/configuration.md',
            '/zh/guide/quick-start.md',
            '/zh/reference/commands.md',
            '/zh/reference/tools.md',
            '/zh/architecture.md',
          ],
        },
      },
    },
  }),
  bundler: viteBundler(),
})
