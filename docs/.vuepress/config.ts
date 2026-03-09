import { defaultTheme } from '@vuepress/theme-default'
import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'

export default defineUserConfig({
  lang: 'en-US',
  title: 'ClawNeo',
  description: 'Personal AI assistant CLI with a Discord bridge',
  base: '/clawneo/',
  head: [
    ['link', { rel: 'icon', href: '/assets/clawneo-hero.jpg' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
  ],
  theme: defaultTheme({
    logo: '/assets/clawneo-hero.jpg',
    repo: 'Tit1e/clawneo',
    docsDir: 'docs',
    navbar: [
      { text: 'Guide', link: '/guide/quick-start.html' },
      { text: 'Reference', link: '/reference/commands.html' },
      { text: 'Architecture', link: '/architecture.html' },
      { text: 'GitHub', link: 'https://github.com/Tit1e/clawneo' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          children: ['/guide/quick-start.md'],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          children: ['/reference/commands.md'],
        },
      ],
      '/': [
        '/',
        '/guide/quick-start.md',
        '/reference/commands.md',
        '/architecture.md',
      ],
    },
  }),
  bundler: viteBundler(),
})
