<script setup>
import { useRouter } from 'vue-router'
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from '../firebase.js'; // Import auth จากไฟล์ที่เราสร้างไว้

const router = useRouter();

const handleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    // ล็อกอินสำเร็จ Firebase จะจำสถานะไว้
    // และ router guard (ใน index.js) จะเด้งเราไปหน้า Dashboard อัตโนมัติ
    // แต่เราก็สั่งเด้งไปเองได้เลย
    router.push('/'); 
  } catch (error) {
    console.error("Login error:", error);
  }
};
</script>

<template>
  <div class="flex justify-center items-center" style="height: 70vh;">
    <div class="card w-96 bg-base-100 shadow-xl">
      <div class="card-body items-center text-center">
        <h2 class="card-title">ยินดีต้อนรับ</h2>
        <p>กรุณาลงชื่อเข้าใช้เพื่อรายงานสถานะกล้อง</p>
        <div class="card-actions mt-4">
          <button @click="handleSignIn" class="btn btn-primary btn-wide">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.94 11c-.46-4.17-3.77-7.5-7.94-7.94V1h-2v2.06C6.8 3.5 3.5 6.8 3.06 11H1v2h2.06c.46 4.17 3.77 7.5 7.94 7.94V23h2v-2.06c4.17-.46 7.5-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  </div>
</template>