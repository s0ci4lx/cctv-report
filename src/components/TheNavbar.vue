<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'

// 2. กำหนด Props ที่จะ "รับ" มาจาก App.vue
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

// 3. กำหนด Event ที่จะ "ส่ง" กลับไปหา App.vue
const emit = defineEmits(['logout'])

// 4. (ใหม่) ตรวจสอบว่าอยู่หน้าไหน
const route = useRoute()

// เช็คว่าอยู่หน้า Admin หรือไม่
const isAdminPage = computed(() => {
  return route.path.startsWith('/admin')
})

// เช็คว่าอยู่หน้า Dashboard หรือไม่
const isDashboardPage = computed(() => {
  return route.path === '/'
})
</script>

<template>
  <div class="navbar bg-base-100 shadow-md mb-4">
    <div class="flex-1">
      <a class="btn btn-ghost text-xl gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        CCTV Daily Report
      </a>
      
      <!-- ปุ่ม Dashboard (แสดงเมื่ออยู่หน้า Admin) -->
      <RouterLink 
        v-if="isAdmin && isAdminPage" 
        to="/" 
        class="btn btn-sm btn-outline btn-primary ml-4 gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Dashboard
      </RouterLink>

      <!-- ปุ่ม จัดการระบบ (แสดงเมื่อไม่อยู่หน้า Admin) -->
      <RouterLink 
        v-if="isAdmin && !isAdminPage" 
        to="/admin" 
        class="btn btn-sm btn-outline btn-info ml-4 gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        จัดการระบบ (Admin)
      </RouterLink>
      
    </div>
    <div class="flex-none">
      <button 
        v-if="isLoggedIn" 
        @click="$emit('logout')" 
        class="btn btn-outline btn-error btn-sm gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        ออกจากระบบ
      </button>
    </div>
  </div>
</template>

<style scoped>
/* เพิ่ม transition ให้ปุ่มสวยขึ้น */
.btn {
  transition: all 0.2s ease-in-out;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
</style>