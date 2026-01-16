import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'

export default defineUserConfig({
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: [
      { text: 'Home', link: '/' },
    ],
  }),
  lang: 'en-US',
  title: 'SmallDraw',
  description: 'SmallDraw Documentation',
})
