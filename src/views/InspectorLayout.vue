<script setup>
import { RouterLink, RouterView, useRoute } from "vue-router";
const route = useRoute();

const isActive = (path) => {
  return route.path.startsWith(path);
};
</script>

<template>
  <div class="container mx-auto p-4 md:p-8">
    <h1
      class="text-4xl font-extrabold text-base-content mb-8 text-center md:text-left"
    >
      Inspector Panel 🔍
    </h1>

    <div role="tablist" class="tabs tabs-boxed mb-8 shadow-lg bg-base-200">
      <RouterLink
        to="/inspector/reports"
        role="tab"
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{
          'tab-active !bg-secondary !text-secondary-content font-semibold':
            isActive('/inspector/reports'),
        }"
      >
        📊 รายงาน Log การตรวจสอบ
      </RouterLink>

      <RouterLink
        to="/inspector/cameras"
        role="tab"
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{
          'tab-active !bg-secondary !text-secondary-content font-semibold':
            isActive('/inspector/cameras'),
        }"
      >
        🎥 รายการกล้องทั้งหมด
      </RouterLink>
      <!-- 👈 เพิ่มแท็บใหม่ -->
      <RouterLink
        to="/inspector/map"
        role="tab"
        class="tab tab-lg transition-all duration-300 hover:bg-base-300"
        :class="{
          'tab-active !bg-secondary !text-secondary-content font-semibold':
            isActive('/inspector/map'),
        }"
      >
        🗺️ แผนที่กล้อง
      </RouterLink>
    </div>

    <RouterView />
  </div>
</template>
