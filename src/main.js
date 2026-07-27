import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { ojsApi } from './services/ojs'

const app = createApp(App)

app.use(router)
app.use(ElementPlus)

app.config.globalProperties.$api = ojsApi

app.mount('#app')
