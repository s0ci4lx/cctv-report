<script setup>
import { RouterLink, useRoute } from "vue-router";
import { computed } from "vue";

// Props
defineProps({
  isLoggedIn: {
    type: Boolean,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    required: true,
  },
  isInspector: {
    type: Boolean,
    required: true,
  },
});

// Event
const emit = defineEmits(["logout"]);

// Route checking
const route = useRoute();

// เช็คว่าอยู่หน้าไหน
const isAdminPage = computed(() => {
  return route.path.startsWith("/admin");
});

const isInspectorPage = computed(() => {
  return route.path.startsWith("/inspector");
});

const isDashboardPage = computed(() => {
  return route.path === "/";
});
</script>

<template>
  <div class="navbar bg-base-100 shadow-md mb-4 px-4 md:px-8 lg:px-12">
    <div class="flex-1 flex items-center">
      <!-- Title -->
      <a class="btn btn-ghost text-lg md:text-xl gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 md:h-6 md:w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span class="hidden sm:inline">รายงานกล้องวงจรปิด สภ.เทพา</span>
        <span class="sm:hidden">สภ.เทพา</span>
      </a>

      <!-- Desktop Navigation (แสดงเฉพาะใน desktop) -->
      <div class="hidden md:inline-flex ">
        <!-- ปุ่ม Dashboard -->
        <RouterLink
          v-if="!isDashboardPage && isLoggedIn"
          to="/"
          class="btn btn-sm btn-outline btn-primary ml-4 gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Dashboard
        </RouterLink>

        <!-- ปุ่มสำหรับ Inspector -->
        <RouterLink
          v-if="isInspector && !isInspectorPage"
          to="/inspector"
          class="btn btn-sm btn-outline btn-secondary ml-4 gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          ตรวจสอบรายงาน
        </RouterLink>

        <!-- ปุ่มสำหรับ Admin -->
        <RouterLink
          v-if="isAdmin && !isAdminPage"
          to="/admin"
          class="btn btn-sm btn-outline btn-info ml-4 gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            จัดการระบบ (Admin)
          </RouterLink>
        </div>
      </div>
      
      <div class="flex-none">
        <div v-if="isLoggedIn" class="flex items-center gap-3">
          <!-- Mobile Hamburger Menu (แสดงเฉพาะใน mobile) -->
          <div class="dropdown dropdown-end md:hidden">
            <div tabindex="0" role="button" class="btn btn-soft hover:btn-secondary btn-circle">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li>
              <div class="badge badge-sm gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span v-if="isAdmin">Admin</span>
                <span v-else-if="isInspector">Inspector</span>
                <span v-else>Officer</span>
              </div>
            </li>
            <div class="divider my-2"></div>
            <li v-if="!isDashboardPage">
              <RouterLink to="/" class="gap-3 hover:bg-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </RouterLink>
            </li>
            <li v-if="isInspector && !isInspectorPage">
              <RouterLink to="/inspector" class="gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                ตรวจสอบรายงาน
              </RouterLink>
            </li>
            <li v-if="isAdmin && !isAdminPage">
              <RouterLink to="/admin" class="gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                จัดการระบบ
              </RouterLink>
            </li>
          </ul>
        </div>

        <!-- Desktop Role Badge (แสดงเฉพาะใน desktop) -->
        <div class="badge badge-info gap-2 hidden md:flex" v-if="isAdmin">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m5.25-2.25l-7.5 7.5L4.5 12"
            />
          </svg>
          Admin
        </div>
        <div
          class="badge badge-secondary gap-2 hidden md:flex"
          v-else-if="isInspector"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Inspector
        </div>
        <div class="badge badge-ghost gap-2 hidden md:flex" v-else>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Officer
        </div>

        <!-- ปุ่ม Logout -->
        <button
          @click="$emit('logout')"
          class="btn btn-outline btn-error btn-sm gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span class="hidden sm:inline">ออกจากระบบ</span>
          <span class="sm:hidden">ออก</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn {
  transition: all 0.2s ease-in-out;
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dropdown:focus-within .dropdown-content {
  display: block;
}
</style>