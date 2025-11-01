import { createApp } from 'vue'

// 1. Import router ที่เราสร้าง
import router from './router' // 👈 เพิ่มบรรทัดนี้

import App from './App.vue'
import './style.css' // (อันนี้คือ Tailwind/DaisyUI CSS)

const app = createApp(App)

// 2. บอกให้แอป "use" router
app.use(router) // 👈 เพิ่มบรรทัดนี้

app.mount('#app')