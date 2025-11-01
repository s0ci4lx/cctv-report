<script setup>
// 1. (อัปเดต) เราไม่ต้องการ RouterLink ที่นี่อีกแล้ว (มันย้ายไป Navbar)
import { RouterView, useRouter } from 'vue-router' 
import { onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from './firebase.js'; // (db ถูก import มา แต่ยังไม่ได้ใช้ในนี้)
import { doc, getDoc } from "firebase/firestore";

// 2. (ใหม่) Import Navbar Component ที่เราเพิ่งสร้าง
import TheNavbar from './components/TheNavbar.vue'

const router = useRouter();
const isLoggedIn = ref(false);
const isAdmin = ref(false);

// 3. (สำคัญ) ฟังก์ชัน handleLogout "ยังคงอยู่ที่นี่" (App.vue)
// เพราะ App.vue เป็นผู้ควบคุม Auth และ Router หลัก
const handleLogout = () => {
  signOut(auth).then(() => {
    isLoggedIn.value = false;
    isAdmin.value = false;
    router.push('/login');
  }).catch((error) => {
    console.error("Logout error:", error);
  });
};

// 4. onMounted (เหมือนเดิมทุกอย่าง)
// มันจะคอยอัปเดต isLoggedIn และ isAdmin
onMounted(() => {
  onAuthStateChanged(auth, async (user) => { 
    if (user) {
      isLoggedIn.value = true;
      try {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        isAdmin.value = adminDoc.exists() && adminDoc.data().isAdmin === true;
      } catch (e) {
        console.error("Error checking admin status:", e);
        isAdmin.value = false;
      }
      
      if (router.currentRoute.value.path === '/login') {
        router.push('/');
      }
    } else {
      isLoggedIn.value = false;
      isAdmin.value = false;
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login');
      }
    }
  });
});
</script>

<template>
  <div class="min-h-screen bg-base-200">
    
    <TheNavbar 
      :isLoggedIn="isLoggedIn" 
      :isAdmin="isAdmin" 
      @logout="handleLogout" 
    />
    
    <main class="container mx-auto px-4">
      <RouterView />
    </main>

  </div>
</template>