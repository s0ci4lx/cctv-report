<script setup>
import { useRouter } from 'vue-router'
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from '../firebase.js';

const router = useRouter();

const handleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    router.push('/');
  } catch (error) {
    console.error("Login error:", error);
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 text-gray-800">
    <div class="bg-white/90 backdrop-blur-lg shadow-2xl rounded-3xl p-10 max-w-md w-full text-center animate-fadeIn">
      
      <!-- โลโก้หรือรูปภาพ -->
      <img
        src="https://www.appsheet.com/template/gettablefileurl?appName=Upload_Picture-2027633&tableName=Picture&fileName=Picture_Images%2F11-02-2025%2016-16-45.Picture.091702.jpg"
        alt="CCTV logo"
        class="mx-auto mb-6 rounded-full shadow-lg w-32 h-32 object-cover"
      />

      <h1 class="text-3xl font-bold text-gray-800 mb-2">
        ยินดีต้อนรับ
      </h1>
      <p class="text-gray-600 mb-8 leading-relaxed">
        ระบบรายงานสถานะกล้องวงจรปิด <br/>
        สถานีตำรวจภูธรเทพา<br/>
        กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google
      </p>

      <!-- ปุ่ม Sign in -->
      <button
        @click="handleSignIn"
        class="btn btn-primary btn-wide gap-2 text-lg shadow-lg hover:scale-105 transition-transform duration-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 11.5v2.8h4.7c-.2 1.2-1.4 3.6-4.7 3.6-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1c1.6 0 2.6.7 3.2 1.3l2.2-2.2C15.5 5.8 13.9 5 12 5 7.9 5 4.6 8.3 4.6 12.4S7.9 19.8 12 19.8c6 0 7.4-5.3 7-8.3H12z"/>
        </svg>
        ลงชื่อเข้าใช้ด้วย Google
      </button>

      <!-- ข้อความล่าง -->
      <p class="mt-8 text-sm text-gray-500">
        © 2025 CCTV Report System · สภ.เทพา
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.6s ease-in-out;
}
</style>
