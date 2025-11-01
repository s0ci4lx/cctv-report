<script setup>
import { RouterLink } from 'vue-router'

// 2. (ใหม่) กำหนด Props ที่จะ "รับ" มาจาก App.vue
// เราคาดหวังว่าจะได้รับ 2 ค่านี้
defineProps({
  isLoggedIn: {
    type: Boolean,
    required: true
  },
  isAdmin: {
    type: Boolean,
    required: true
  }
})

// 3. (ใหม่) กำหนด Event ที่จะ "ส่ง" กลับไปหา App.vue
// เราจะส่ง event ชื่อ 'logout'
const emit = defineEmits(['logout'])
</script>

<template>
  <div class="navbar bg-base-100 shadow-md mb-4">
    <div class="flex-1">
      <a class="btn btn-ghost text-xl">CCTV Daily Report</a>
      
      <RouterLink v-if="isAdmin" to="/admin" class="btn btn-sm btn-outline btn-info ml-4">
        จัดการระบบ (Admin)
      </RouterLink>
      
    </div>
    <div class="flex-none">
      <button v-if="isLoggedIn" @click="$emit('logout')" class="btn btn-outline btn-error btn-sm">
        ออกจากระบบ
      </button>
    </div>
  </div>
</template>