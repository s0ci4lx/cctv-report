<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
const route = useRoute();
const isActive = (path) => {
  return route.path === path;
};
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-4">Admin Panel</h1>
    
    <div role="tablist" class="tabs tabs-boxed mb-6">
      <RouterLink 
        to="/admin/reports" 
        role="tab" 
        class="tab"
        :class="{ 'tab-active': isActive('/admin/reports') }"
      >
        📊 ดูรายงาน (Logs)
      </RouterLink>

      <RouterLink 
        to="/admin/cameras" 
        role="tab" 
        class="tab"
        :class="{ 'tab-active': isActive('/admin/cameras') }"
      >
        🎥 จัดการกล้อง
      </RouterLink>
      
      <RouterLink 
        to="/admin/assignments" 
        role="tab" 
        class="tab"
        :class="{ 'tab-active': isActive('/admin/assignments') }"
      >
        🔧 จัดการ Assignments
      </RouterLink>
      
      <RouterLink 
        to="/admin/officers" 
        role="tab" 
        class="tab"
        :class="{ 'tab-active': isActive('/admin/officers') }"
      >
        🧑‍✈️ จัดการเจ้าหน้าที่
      </RouterLink>
    </div>

    <RouterView />
  </div>
</template>