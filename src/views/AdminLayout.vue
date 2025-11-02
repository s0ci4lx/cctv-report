<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
const route = useRoute();

const isActive = (path) => {
  return route.path.startsWith(path);
};
</script>

<template>
  <div class="container mx-auto p-4 md:p-8">
    <h1 class="text-4xl font-extrabold text-base-content mb-8 text-center md:text-left">
      Admin Panel ✨
    </h1>
    
    <div role="tablist" class="tabs tabs-boxed mb-8 shadow-lg bg-base-200">
      <RouterLink 
        to="/admin/reports" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300" 
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/reports') }"
      >
        📊 ดูรายงาน (Logs)
      </RouterLink>
      
      <RouterLink 
        to="/admin/cameras" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/cameras') }"
      >
        📹 จัดการกล้อง
      </RouterLink>
      
      <RouterLink 
        to="/admin/assignments" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/assignments') }"
      >
        🎯 จัดการ Assignments
      </RouterLink>
      
      <RouterLink 
        to="/admin/officers" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/officers') }"
      >
        👥 จัดการรายชื่อเจ้าหน้าที่
      </RouterLink>

      <!-- ใหม่! -->
      <RouterLink 
        to="/admin/users" 
        role="tab" 
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{ 'tab-active !bg-primary !text-primary-content font-semibold': isActive('/admin/users') }"
      >
        🔐 จัดการผู้ใช้งาน
      </RouterLink>
    </div>
    
    <RouterView />
  </div>
</template>