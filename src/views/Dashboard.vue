<script setup>
import { ref, onMounted, computed } from 'vue';
import { auth, db } from '../firebase.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

// --- State Variables ---
const tasks = ref([]);
const cameras = ref([]); // 👈 (ใหม่) รายการกล้องทั้งหมด
const loading = ref(true);
const submittingReport = ref(false);
const userName = ref(auth.currentUser?.displayName || 'User');
const userEmail = ref(auth.currentUser?.email);
const searchQuery = ref('');
const filterStatus = ref('all'); // all, reported, pending

// --- Computed Properties ---
const totalCameras = computed(() => tasks.value.length);
const reportedCount = computed(() => tasks.value.filter(t => t.reportedToday).length);
const pendingCount = computed(() => tasks.value.filter(t => !t.reportedToday).length);

// กรองกล้องตามคำค้นหาและสถานะ
const filteredTasks = computed(() => {
  let result = tasks.value;
  
  // กรองตามคำค้นหา
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(task => 
      task.cameraName.toLowerCase().includes(query) ||
      task.cameraID?.toLowerCase().includes(query)
    );
  }
  
  // กรองตามสถานะ
  if (filterStatus.value === 'reported') {
    result = result.filter(task => task.reportedToday);
  } else if (filterStatus.value === 'pending') {
    result = result.filter(task => !task.reportedToday);
  }
  
  return result;
});

// --- Functions ---

// (ใหม่) หาข้อมูลกล้องจาก cameraID
const getCameraInfo = (cameraID) => {
  return cameras.value.find(c => c.cameraID === cameraID);
};

const fetchTasks = async () => {
  loading.value = true;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- 1. ดึงรายการกล้องทั้งหมดก่อน ---
    const camerasQuery = query(collection(db, "cameras"));
    const camerasSnapshot = await getDocs(camerasQuery);
    cameras.value = [];
    camerasSnapshot.forEach((doc) => {
      cameras.value.push({ id: doc.id, ...doc.data() });
    });

    // --- 2. ดึง Assignments ของเรา ---
    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("officerEmail", "==", userEmail.value)
    );

    // --- 3. ดึงรายงานวันนี้ ---
    const reportsQuery = query(
      collection(db, "reports_log"),
      where("officerEmail", "==", userEmail.value),
      where("timestamp", ">=", today)
    );

    const [assignmentsSnapshot, reportsSnapshot] = await Promise.all([
      getDocs(assignmentsQuery),
      getDocs(reportsQuery)
    ]);

    // --- 4. สร้าง Set ของงานที่รายงานแล้ว ---
    const reportedIds = new Set();
    reportsSnapshot.forEach((doc) => {
      reportedIds.add(doc.data().cameraId);
    });

    // --- 5. ประมวลผลงาน (ดึงข้อมูลจาก cameras) ---
    const fetchedTasks = [];
    assignmentsSnapshot.forEach((doc) => {
      const assignment = doc.data();
      const cameraInfo = getCameraInfo(assignment.cameraID);
      
      // ถ้าหากล้องใน cameras collection
      if (cameraInfo) {
        fetchedTasks.push({
          id: doc.id,
          cameraID: cameraInfo.cameraID,
          cameraName: cameraInfo.cameraName,
          latitude: cameraInfo.latitude,
          longitude: cameraInfo.longitude,
          photoURL: cameraInfo.photoURL,
          reportedToday: reportedIds.has(doc.id)
        });
      } else {
        // ถ้าไม่เจอ (กรณีข้อมูลไม่ตรงกัน)
        fetchedTasks.push({
          id: doc.id,
          cameraID: assignment.cameraID,
          cameraName: assignment.cameraID, // ใช้ ID แทน
          latitude: null,
          longitude: null,
          photoURL: null,
          reportedToday: reportedIds.has(doc.id)
        });
      }
    });
    
    tasks.value = fetchedTasks;
  } catch (e) {
    console.error("Failed to fetch tasks:", e);
    alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
  } finally {
    loading.value = false;
  }
};

// ส่งรายงาน
const handleReport = async (taskId, status) => {
  submittingReport.value = true;
  try {
    let notes = '';
    
    if (status === 'Issue') {
      notes = prompt('กรุณาระบุปัญหา:');
      if (notes === null) {
        submittingReport.value = false;
        return;
      }
    }

    await addDoc(collection(db, "reports_log"), {
      cameraId: taskId,
      status: status,
      notes: notes || '',
      officerEmail: userEmail.value,
      timestamp: serverTimestamp()
    });

    // อัปเดต UI
    const task = tasks.value.find(t => t.id === taskId);
    if (task) {
      task.reportedToday = true;
    }

    // แสดงข้อความสำเร็จ
    showSuccessToast(status === 'Normal' ? 'บันทึกสถานะปกติแล้ว ✅' : 'บันทึกปัญหาแล้ว ⚠️');
  } catch (e) {
    console.error("Failed to submit report:", e);
    alert("เกิดข้อผิดพลาดในการส่งรายงาน");
  } finally {
    submittingReport.value = false;
  }
};

// Toast Notification
const showSuccessToast = (message) => {
  const toast = document.createElement('div');
  toast.className = 'toast toast-top toast-end';
  toast.innerHTML = `
    <div class="alert alert-success">
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
};

// (ใหม่) เปิด Modal แสดงรูปภาพ
const showImageModal = (photoURL) => {
  if (!photoURL) return;
  
  const modal = document.createElement('dialog');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg mb-4">ภาพมุมกล้อง</h3>
      <figure class="bg-base-200 rounded-lg overflow-hidden">
        <img src="${photoURL}" alt="Camera View" class="w-full" />
      </figure>
      <div class="modal-action">
        <button class="btn" onclick="this.closest('dialog').close()">ปิด</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;
  document.body.appendChild(modal);
  modal.showModal();
  modal.addEventListener('close', () => {
    modal.remove();
  });
};

// (ใหม่) เปิดแผนที่
const openMap = (lat, lng) => {
  if (!lat || !lng) return;
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
};

// --- Lifecycle ---
onMounted(() => {
  fetchTasks();
});
</script>

<template>
  <div class="py-6">
    <!-- Header Section -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-base-content mb-2">
        สวัสดี, {{ userName }} 👋
      </h1>
      <p class="text-base-content/70">
        รายงานสถานภาพกล้องวงจรปิดประจำวัน
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="mt-4 text-base-content/70">กำลังโหลดรายการกล้อง...</p>
    </div>

    <!-- Main Content -->
    <div v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <!-- Card 1: Total -->
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div class="stat-title">กล้องทั้งหมด</div>
            <div class="stat-value text-primary">{{ totalCameras }}</div>
            <div class="stat-desc">จุดที่รับผิดชอบ</div>
          </div>
        </div>

        <!-- Card 2: Reported -->
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-success">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="stat-title">รายงานแล้ว</div>
            <div class="stat-value text-success">{{ reportedCount }}</div>
            <div class="stat-desc">{{ totalCameras > 0 ? Math.round((reportedCount/totalCameras)*100) : 0 }}% เสร็จสิ้น</div>
          </div>
        </div>

        <!-- Card 3: Pending -->
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-warning">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="stat-title">รอดำเนินการ</div>
            <div class="stat-value text-warning">{{ pendingCount }}</div>
            <div class="stat-desc">ยังไม่ได้รายงาน</div>
          </div>
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="card bg-base-100 shadow-md mb-6">
        <div class="card-body p-4">
          <div class="flex flex-col md:flex-row gap-4">
            <!-- Search Input -->
            <div class="form-control flex-1">
              <div class="input-group">
                <!-- <span class="bg-base-200">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span> -->
                <input 
                  v-model="searchQuery"
                  type="text" 
                  placeholder="ค้นหาชื่อกล้อง หรือ UID..." 
                  class="input input-bordered flex-1"
                />
              </div>
            </div>

            <!-- Filter Tabs -->
            <div class="tabs tabs-boxed">
              <a 
                class="tab" 
                :class="{ 'tab-active': filterStatus === 'all' }"
                @click="filterStatus = 'all'"
              >
                ทั้งหมด ({{ totalCameras }})
              </a>
              <a 
                class="tab" 
                :class="{ 'tab-active': filterStatus === 'pending' }"
                @click="filterStatus = 'pending'"
              >
                รอรายงาน ({{ pendingCount }})
              </a>
              <a 
                class="tab" 
                :class="{ 'tab-active': filterStatus === 'reported' }"
                @click="filterStatus = 'reported'"
              >
                เสร็จแล้ว ({{ reportedCount }})
              </a>
            </div>

            <!-- Refresh Button -->
            <button @click="fetchTasks" class="btn btn-square btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Camera Cards Grid -->
      <div v-if="filteredTasks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="task in filteredTasks" 
          :key="task.id" 
          class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300"
          :class="{ 'border-2 border-success': task.reportedToday }"
        >
          <!-- Camera Photo (ใหม่!) -->
          <figure v-if="task.photoURL" class="relative h-48 bg-base-200 cursor-pointer" @click="showImageModal(task.photoURL)">
            <img 
              :src="task.photoURL" 
              :alt="task.cameraName"
              class="w-full h-full object-cover"
              @error="(e) => e.target.style.display = 'none'"
            />
            <div class="absolute top-2 right-2">
              <button class="btn btn-circle btn-sm btn-ghost bg-base-100/70 backdrop-blur">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </figure>
          <figure v-else class="h-48 bg-base-200 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </figure>

          <div class="card-body">
            <!-- Camera Icon & Status Badge -->
            <div class="flex justify-between items-start mb-2">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-12">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              
              <div v-if="task.reportedToday" class="badge badge-success badge-lg gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                เสร็จแล้ว
              </div>
              <div v-else class="badge badge-warning badge-lg gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                รอรายงาน
              </div>
            </div>

            <!-- Camera Name -->
            <h2 class="card-title text-xl">
              {{ task.cameraName }}
            </h2>

            <!-- Camera UID -->
            <p class="text-sm text-base-content/70">
              <span class="font-semibold">UID:</span> 
              <span class="badge badge-ghost">{{ task.cameraID }}</span>
            </p>

            <!-- Location (ใหม่!) -->
            <div v-if="task.latitude && task.longitude" class="flex items-center gap-2 text-sm mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <button 
                @click="openMap(task.latitude, task.longitude)"
                class="link link-primary text-xs"
              >
                {{ task.latitude.toFixed(4) }}, {{ task.longitude.toFixed(4) }}
              </button>
            </div>

            <!-- Divider -->
            <div class="divider my-2"></div>

            <!-- Action Buttons -->
            <div v-if="!task.reportedToday" class="card-actions justify-end">
              <button 
                @click="handleReport(task.id, 'Issue')" 
                class="btn btn-warning btn-sm gap-2"
                :disabled="submittingReport"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                มีปัญหา
              </button>
              <button 
                @click="handleReport(task.id, 'Normal')" 
                class="btn btn-success btn-sm gap-2"
                :disabled="submittingReport"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ปกติ
              </button>
            </div>

            <!-- Already Reported Message -->
            <div v-else class="alert alert-success shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm">รายงานสถานภาพแล้ววันนี้</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-20">
        <div class="max-w-md mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-xl font-bold mb-2">ไม่พบรายการกล้อง</h3>
          <p class="text-base-content/70">
            {{ searchQuery ? 'ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา' : 'ไม่พบรายการกล้องที่คุณรับผิดชอบในขณะนี้' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Animation */
.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-4px);
}

/* Toast Animation */
.toast {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Figure hover effect */
figure img {
  transition: transform 0.3s ease-in-out;
}

figure:hover img {
  transform: scale(1.05);
}
</style>