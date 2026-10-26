import DefaultTheme from 'vitepress/theme-without-fonts'
import { withBase } from 'vitepress'
import Layout from './Layout.vue'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './tokens.css'
import './base.css'
import './home.css'
import './docs.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    // Preserve existing documentation image expressions while keeping assets local.
    app.config.globalProperties.$withBase = withBase
  },
}
