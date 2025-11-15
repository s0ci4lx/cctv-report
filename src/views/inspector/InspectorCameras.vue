<script setup>
import { ref, reactive, onMounted, computed, onUnmounted } from "vue";
import { db } from "../../firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

// 👇 เพิ่มตัวเลือกประเภทกล้อง
const cameraTypes = [
  { value: '4G', label: '4G', icon: '📡', color: 'badge-primary' },
  { value: 'WIFI', label: 'WIFI', icon: '📶', color: 'badge-info' },
  { value: 'Tactical', label: 'Tactical', icon: '🎯', color: 'badge-warning' }
];

// ฟังก์ชันหาข้อมูล Camera Type
const getCameraTypeInfo = (type) => {
  return cameraTypes.find(t => t.value === type) || cameraTypes[0];
};

// --- State ---
const cameras = ref([]);
const assignments = ref([]);
const officersList = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const sortBy = ref('cameraID');
const viewMode = ref('cards');
const isLargeScreen = ref(true);

// State สำหรับ Preview รูป
const previewImage = ref(null);

// --- Computed ---
const totalCameras = computed(() => cameras.value.length);
const assignedCameras = computed(() => {
  const assignedIds = new Set(assignments.value.map(a => a.cameraID));
  return cameras.value.filter(c => assignedIds.has(c.cameraID)).length;
});
const unassignedCameras = computed(() => totalCameras.value - assignedCameras.value);

// 👇 นับจำนวนกล้องแต่ละประเภท
const camera4GCount = computed(() => 
  cameras.value.filter(c => (c.cameraType || '4G') === '4G').length
);
const cameraWIFICount = computed(() => 
  cameras.value.filter(c => c.cameraType === 'WIFI').length
);
const cameraTacticalCount = computed(() => 
  cameras.value.filter(c => c.cameraType === 'Tactical').length
);

// View mode ที่มีผล - บังคับเป็น cards สำหรับหน้าจอเล็ก
const effectiveViewMode = computed(() => {
  return isLargeScreen.value ? viewMode.value : 'cards';
});

// กรองและค้นหา
const filteredCameras = computed(() => {
  let result = cameras.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(c => 
      c.cameraID.toLowerCase().includes(query) ||
      c.cameraName.toLowerCase().includes(query)
    );
  }

  result = [...result].sort((a, b) => {
    if (sortBy.value === 'cameraID') {
      return a.cameraID.localeCompare(b.cameraID);
    } else if (sortBy.value === 'cameraName') {
      return a.cameraName.localeCompare(b.cameraName, 'th');
    } else if (sortBy.value === 'status') {
      const aAssigned = isAssigned(a.cameraID);
      const bAssigned = isAssigned(b.cameraID);
      return bAssigned - aAssigned;
    }
    return 0;
  });

  return result;
});

// --- Functions ---

const fetchCameras = async () => {
  cameras.value = [];
  try {
    const q = query(collection(db, "cameras"), orderBy("cameraID"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      cameras.value.push({ id: doc.id, ...doc.data() });
    });
  } catch (e) {
    console.error("Error fetching cameras: ", e);
    alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
  }
};

const fetchAssignments = async () => {
  assignments.value = [];
  try {
    const q = query(collection(db, "assignments"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      assignments.value.push({ id: doc.id, ...doc.data() });
    });
  } catch (e) {
    console.error("Error fetching assignments: ", e);
  }
};

const fetchOfficers = async () => {
  officersList.value = [];
  try {
    const q = query(collection(db, "officers"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      officersList.value.push(doc.data());
    });
  } catch (e) {
    console.error("Error fetching officers: ", e);
  }
};

const isAssigned = (cameraID) => {
  return assignments.value.some(a => a.cameraID === cameraID);
};

const getAssignedOfficer = (cameraID) => {
  const assignment = assignments.value.find(a => a.cameraID === cameraID);
  if (!assignment) return null;
  
  const officer = officersList.value.find(o => o.email === assignment.officerEmail);
  return officer ? officer.name : assignment.officerEmail;
};

const openImagePreview = (url) => {
  previewImage.value = url;
  document.getElementById('image_preview_modal').showModal();
};

const openMap = (lat, lng) => {
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
};

const copyToClipboard = async (text, successMessage = "คัดลอกแล้ว ✅") => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, "success");
  } catch (err) {
    console.error("Failed to copy:", err);
    showToast("ไม่สามารถคัดลอกได้ ❌", "error");
  }
};

const showToast = (message, type = 'success') => {
  const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
  const toast = document.createElement('div');
  toast.className = 'toast toast-top toast-end z-50';
  toast.innerHTML = `
    <div class="alert ${alertClass}">
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
};

const updateScreenSize = () => {
  if (typeof window !== 'undefined') {
    isLargeScreen.value = window.innerWidth >= 1024;
  }
};

// --- Lifecycle ---
onMounted(async () => {
  loading.value = true;
  
  updateScreenSize();
  
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateScreenSize);
  }
  
  await Promise.all([
    fetchCameras(),
    fetchAssignments(),
    fetchOfficers()
  ]);
  loading.value = false;
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateScreenSize);
  }
});
</script>

<template>
  <div class="py-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">รายการกล้องทั้งหมด</h2>
        <p class="text-base-content/70">
          กล้องวงจรปิดทั้งหมดในระบบ ({{ totalCameras }} ตัว)
        </p>
      </div>

      <div class="flex gap-2">
        <button @click="fetchCameras(); fetchAssignments();" class="btn btn-ghost gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          รีเฟรช
        </button>
      </div>
    </div>

    <!-- Statistics - 6 Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <!-- Card 1: Total -->
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="stat-title">กล้องทั้งหมด</div>
          <div class="stat-value text-primary">{{ totalCameras }}</div>
          <div class="stat-desc">จำนวนกล้องในระบบ</div>
        </div>
      </div>

      <!-- Card 2: Assigned -->
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-success">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-title">มอบหมายแล้ว</div>
          <div class="stat-value text-success">{{ assignedCameras }}</div>
          <div class="stat-desc">{{ totalCameras > 0 ? Math.round((assignedCameras/totalCameras)*100) : 0 }}% ของทั้งหมด</div>
        </div>
      </div>

      <!-- Card 3: Unassigned -->
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-title">ยังไม่มอบหมาย</div>
          <div class="stat-value text-warning">{{ unassignedCameras }}</div>
          <div class="stat-desc">รอการมอบหมาย</div>
        </div>
      </div>

      <!-- Card 4: 4G Cameras -->
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-primary">
            <div class="text-4xl">📡</div>
          </div>
          <div class="stat-title">กล้อง 4G</div>
          <div class="stat-value text-primary">{{ camera4GCount }}</div>
          <div class="stat-desc">{{ totalCameras > 0 ? Math.round((camera4GCount/totalCameras)*100) : 0 }}% ของทั้งหมด</div>
        </div>
      </div>

      <!-- Card 5: WIFI Cameras -->
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-info">
            <div class="text-4xl">📶</div>
          </div>
          <div class="stat-title">กล้อง WIFI</div>
          <div class="stat-value text-info">{{ cameraWIFICount }}</div>
          <div class="stat-desc">{{ totalCameras > 0 ? Math.round((cameraWIFICount/totalCameras)*100) : 0 }}% ของทั้งหมด</div>
        </div>
      </div>

      <!-- Card 6: Tactical Cameras -->
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-warning">
            <div class="text-4xl">🎯</div>
          </div>
          <div class="stat-title">กล้อง Tactical</div>
          <div class="stat-value text-warning">{{ cameraTacticalCount }}</div>
          <div class="stat-desc">{{ totalCameras > 0 ? Math.round((cameraTacticalCount/totalCameras)*100) : 0 }}% ของทั้งหมด</div>
        </div>
      </div>
    </div>

    <!-- Search & Sort Bar -->
    <div class="card bg-base-100 shadow-md mb-6">
      <div class="card-body p-4">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="form-control flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหา UID หรือจุดติดตั้ง..."
              class="input input-bordered flex-1 w-full"
            />
          </div>

          <div class="form-control">
            <select v-model="sortBy" class="select select-bordered w-full">
              <option value="cameraID">เรียงตาม: Camera UID</option>
              <option value="cameraName">เรียงตาม: จุดติดตั้ง</option>
              <option value="status">เรียงตาม: สถานะ</option>
            </select>
          </div>

          <div v-if="isLargeScreen" class="form-control my-auto">
            <div class="join">
              <button 
                class="join-item btn btn-sm gap-2" 
                :class="{ 'btn-active': viewMode === 'cards' }"
                @click="viewMode = 'cards'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                การ์ด
              </button>
              <button 
                class="join-item btn btn-sm gap-2" 
                :class="{ 'btn-active': viewMode === 'table' }"
                @click="viewMode = 'table'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                ตาราง
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Table View -->
    <div v-else-if="!loading && filteredCameras.length > 0 && effectiveViewMode === 'table' && isLargeScreen" class="block">
      <div class="card bg-base-100 shadow-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead class="bg-base-200">
              <tr>
                <th class="w-20">รูปภาพ</th>
                <th>ประเภท</th>
                <th>Camera UID</th>
                <th>จุดติดตั้ง</th>
                <th class="w-20 text-center">สถานะ</th>
                <th>เจ้าหน้าที่</th>
                <th>พิกัด</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="camera in filteredCameras" :key="camera.id" class="hover">
                <!-- รูปภาพ -->
                <td>
                  <div class="avatar">
                    <div class="w-16 h-16 rounded-lg">
                      <img 
                        v-if="camera.photoURL"
                        :src="camera.photoURL" 
                        :alt="camera.cameraName"
                        class="w-full h-full object-cover cursor-pointer"
                        @click="openImagePreview(camera.photoURL)"
                        @error="(e) => e.target.style.display = 'none'"
                      />
                      <div v-else class="w-full h-full bg-base-200 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- ประเภทกล้อง -->
                <td>
                  <div class="badge badge-lg gap-2" :class="getCameraTypeInfo(camera.cameraType || '4G').color">
                    <span>{{ getCameraTypeInfo(camera.cameraType || '4G').icon }}</span>
                    <span class="text-xs font-semibold">{{ getCameraTypeInfo(camera.cameraType || '4G').label }}</span>
                  </div>
                </td>

                <!-- Camera UID -->
                <td>
                  <button
                    @click="copyToClipboard(camera.cameraID, `คัดลอก ${camera.cameraID} แล้ว ✅`)"
                    class="btn btn-soft btn-primary btn-sm hover:badge-primary transition-colors cursor-pointer"
                    title="คลิกเพื่อคัดลอก"
                  >
                    {{ camera.cameraID }}
                  </button>
                </td>

                <!-- จุดติดตั้ง -->
                <td>
                  <div class="font-medium">{{ camera.cameraName }}</div>
                </td>

                <!-- สถานะ (แค่ไอคอน) -->
                <td class="text-center">
                  <div 
                    v-if="isAssigned(camera.cameraID)" 
                    class="tooltip tooltip-success" 
                    data-tip="มอบหมายแล้ว"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div 
                    v-else 
                    class="tooltip tooltip-warning" 
                    data-tip="ยังไม่มอบหมาย"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </td>

                <!-- เจ้าหน้าที่ -->
                <td>
                  <div v-if="isAssigned(camera.cameraID)" class="text-sm">
                    <div class="font-medium">{{ getAssignedOfficer(camera.cameraID) }}</div>
                  </div>
                  <div v-else class="text-sm text-base-content/50">-</div>
                </td>

                <!-- พิกัด -->
                <td>
                  <div v-if="camera.latitude && camera.longitude" class="flex items-center gap-1">
                    <button 
                      @click="openMap(camera.latitude, camera.longitude)"
                      class="link link-primary text-xs hover:text-primary-focus"
                      title="เปิดแผนที่"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {{ camera.latitude.toFixed(4) }}, {{ camera.longitude.toFixed(4) }}
                    </button>
                  </div>
                  <div v-else class="text-sm text-base-content/50">-</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Cards View -->
    <div v-else-if="!loading && filteredCameras.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="camera in filteredCameras" 
        :key="camera.id"
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300"
        :class="{ 'border-2 border-success': isAssigned(camera.cameraID) }"
      >
        <!-- Camera Photo -->
        <figure v-if="camera.photoURL" class="relative h-48 bg-base-200 cursor-pointer" @click="openImagePreview(camera.photoURL)">
          <img 
            :src="camera.photoURL" 
            :alt="camera.cameraName"
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
          <!-- Badge ประเภท & สถานะ -->
          <div class="flex justify-between items-start mb-4">
            <div class="flex flex-col gap-2">
              <!-- Badge ประเภทกล้อง -->
              <div class="badge badge-lg gap-2" :class="getCameraTypeInfo(camera.cameraType || '4G').color">
                <span class="text-lg">{{ getCameraTypeInfo(camera.cameraType || '4G').icon }}</span>
                <span class="font-semibold">{{ getCameraTypeInfo(camera.cameraType || '4G').label }}</span>
              </div>
            </div>
            
            <!-- Status Badge -->
            <div v-if="isAssigned(camera.cameraID)" class="badge badge-success badge-lg gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              มอบหมายแล้ว
            </div>
            <div v-else class="badge badge-warning badge-lg gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ยังไม่มอบหมาย
            </div>
          </div>

          <!-- Camera Name -->
          <h2 class="card-title text-xl">
            {{ camera.cameraName }}
          </h2>

          <!-- Camera UID -->
          <p class="text-sm text-base-content/70">
            
            <button 
              @click="copyToClipboard(camera.cameraID, `คัดลอก ${camera.cameraID} แล้ว ✅`)"
              class="btn btn-soft btn-primary btn-sm hover:badge-primary transition-colors cursor-pointer"
              title="คลิกเพื่อคัดลอก"
            >
              <span class="font-semibold">UID: </span> {{ camera.cameraID }}
            </button>
          </p>

          <!-- Assigned Officer -->
          <div v-if="isAssigned(camera.cameraID)" class="mt-2">
            <p class="text-sm text-base-content/70">
              <span class="font-semibold">เจ้าหน้าที่: </span>
              <span class="text-base-content">{{ getAssignedOfficer(camera.cameraID) }}</span>
            </p>
          </div>

          <!-- Location -->
          <div v-if="camera.latitude && camera.longitude" class="flex items-center gap-2 text-sm mt-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <button 
              @click="openMap(camera.latitude, camera.longitude)"
              class="link link-primary text-xs"
            >
              {{ camera.latitude.toFixed(4) }}, {{ camera.longitude.toFixed(4) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && filteredCameras.length === 0" class="text-center py-20">
      <div class="max-w-md mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 class="text-xl font-bold mb-2">ไม่พบกล้อง</h3>
        <p class="text-base-content/70">
          {{ searchQuery ? 'ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา' : 'ไม่มีกล้องในระบบในขณะนี้' }}
        </p>
        <div v-if="searchQuery" class="mt-4">
          <button @click="searchQuery = ''" class="btn btn-primary">ล้างการค้นหา</button>
        </div>
      </div>
    </div>

    <!-- Image Preview Modal -->
    <dialog id="image_preview_modal" class="modal">
      <div class="modal-box max-w-4xl w-11/12">
        <h3 class="font-bold text-lg mb-4">ภาพมุมกล้อง</h3>
        <figure class="bg-base-200 rounded-lg overflow-hidden">
          <img v-if="previewImage" :src="previewImage" alt="Camera View" class="w-full" />
        </figure>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn">ปิด</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-4px);
}

figure img {
  transition: transform 0.3s ease-in-out;
}

figure:hover img {
  transform: scale(1.05);
}

.table {
  font-size: 0.875rem;
}
</style>