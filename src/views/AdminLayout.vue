<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
const route = useRoute();
const isActive = (path) => {
  // ตรวจสอบว่าเส้นทางปัจจุบันเริ่มต้นด้วย path ที่กำหนดหรือไม่
  // เพื่อให้ tab ทำงานได้ถูกต้องกับ sub-routes (เช่น /admin/reports/detail)
  return route.path.startsWith(path);
};
</script>

<template>
  <div class="container mx-auto p-4 md:p-8"> <h1 class="text-4xl font-extrabold text-base-content mb-8 text-center md:text-left"> Admin Panel ✨
    </h1>
    
    <div role="tablist" class="tabs tabs-boxed mb-8 shadow-lg bg-base-200"> <RouterLink 
        to="/admin/reports" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300" :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/reports') }" >
        📊 ดูรายงาน (Logs)
      </RouterLink>

      <RouterLink 
        to="/admin/cameras" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/cameras') }"
      >
        🎥 จัดการกล้อง
      </RouterLink>
      
      <RouterLink 
        to="/admin/assignments" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/assignments') }"
      >
        🔧 จัดการ Assignments
      </RouterLink>
      
      <RouterLink 
        to="/admin/officers" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/officers') }"
      >
        🧑‍✈️ จัดการเจ้าหน้าที่
      </RouterLink>
    </div>

    <RouterView />
  </div>
</template>