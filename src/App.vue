<script setup>
import { RouterView, useRouter } from 'vue-router' 
import { onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from './firebase.js';
import { doc, getDoc } from "firebase/firestore";
import TheNavbar from './components/TheNavbar.vue'

const router = useRouter();
const isLoggedIn = ref(false);
const isAdmin = ref(false);
const isInspector = ref(false);

const handleLogout = () => {
  signOut(auth).then(() => {
    isLoggedIn.value = false;
    isAdmin.value = false;
    isInspector.value = false;
    router.push('/login');
  }).catch((error) => {
    console.error("Logout error:", error);
  });
};

onMounted(() => {
  onAuthStateChanged(auth, async (user) => { 
    if (user) {
      isLoggedIn.value = true;
      try {
        // เช็ค Admin ด้วย Email
        const adminDoc = await getDoc(doc(db, "admins", user.email));
        isAdmin.value = adminDoc.exists();
        
        // เช็ค Inspector ด้วย Email
        if (!isAdmin.value) {
          const inspectorDoc = await getDoc(doc(db, "inspectors", user.email));
          isInspector.value = inspectorDoc.exists();
        } else {
          isInspector.value = false;
        }
        
      } catch (e) {
        console.error("Error checking user roles:", e);
        isAdmin.value = false;
        isInspector.value = false;
      }
      
      if (router.currentRoute.value.path === '/login') {
        router.push('/');
      }
    } else {
      // user logged out
      isLoggedIn.value = false;
      isAdmin.value = false;
      isInspector.value = false;
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
      :isInspector="isInspector"
      @logout="handleLogout" 
    />
    
    <main class="container mx-auto px-4">
      <RouterView />
    </main>
  </div>
</template>