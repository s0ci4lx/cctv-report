<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { db } from "../../firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
} from "firebase/firestore";

// --- State ---
const cameras = ref([]);
const assignments = ref([]);
const officersList = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const sortBy = ref('cameraID'); // cameraID, cameraName, status

// State สำหรับฟอร์มเพิ่ม
const newCamera = reactive({
  cameraID: '',
  cameraName: '',
  latitude: '',
  longitude: '',
  photoURL: ''
});

// State สำหรับฟอร์มแก้ไข
const editingCamera = ref(null);

// State สำหรับ Preview รูป
const previewImage = ref(null);

// State สำหรับ Validation
const formErrors = reactive({
  cameraID: '',
  cameraName: '',
  latitude: '',
  longitude: '',
  photoURL: ''
});

// --- Computed ---
const totalCameras = computed(() => cameras.value.length);
const assignedCameras = computed(() => {
  const assignedIds = new Set(assignments.value.map(a => a.cameraID));
  return cameras.value.filter(c => assignedIds.has(c.cameraID)).length;
});
const unassignedCameras = computed(() => totalCameras.value - assignedCameras.value);

// กรองและค้นหา
const filteredCameras = computed(() => {
  let result = cameras.value;

  // ค้นหา
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(c => 
      c.cameraID.toLowerCase().includes(query) ||
      c.cameraName.toLowerCase().includes(query)
    );
  }

  // เรียงลำดับ
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

// ดึงข้อมูลกล้อง
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

// ดึงข้อมูล assignments เพื่อเช็คสถานะ
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

// เช็คว่ากล้องถูกมอบหมายหรือยัง
const isAssigned = (cameraID) => {
  return assignments.value.some(a => a.cameraID === cameraID);
};

// หาเจ้าหน้าที่ที่ดูแลกล้อง
const getAssignedOfficer = (cameraID) => {
  const assignment = assignments.value.find(a => a.cameraID === cameraID);
  if (!assignment) return null;
  
  // หาชื่อจาก email
  const officer = officersList.value.find(o => o.email === assignment.officerEmail);
  return officer ? officer.name : assignment.officerEmail;
};

// Validation
const validateForm = (data) => {
  formErrors.cameraID = '';
  formErrors.cameraName = '';
  formErrors.latitude = '';
  formErrors.longitude = '';
  formErrors.photoURL = '';
  let isValid = true;

  if (!data.cameraID || data.cameraID.trim().length < 2) {
    formErrors.cameraID = 'กรุณากรอก Camera UID อย่างน้อย 2 ตัวอักษร';
    isValid = false;
  }

  if (!data.cameraName || data.cameraName.trim().length < 2) {
    formErrors.cameraName = 'กรุณากรอกจุดติดตั้งอย่างน้อย 2 ตัวอักษร';
    isValid = false;
  }

  // Validate Latitude (-90 to 90)
  if (data.latitude !== '' && (isNaN(data.latitude) || data.latitude < -90 || data.latitude > 90)) {
    formErrors.latitude = 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90';
    isValid = false;
  }

  // Validate Longitude (-180 to 180)
  if (data.longitude !== '' && (isNaN(data.longitude) || data.longitude < -180 || data.longitude > 180)) {
    formErrors.longitude = 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180';
    isValid = false;
  }

  // Validate URL (optional)
  if (data.photoURL && data.photoURL.trim() !== '') {
    try {
      new URL(data.photoURL);
    } catch {
      formErrors.photoURL = 'กรุณากรอก URL ที่ถูกต้อง';
      isValid = false;
    }
  }

  return isValid;
};

// เปิด Modal เพิ่ม
const openAddModal = () => {
  newCamera.cameraID = '';
  newCamera.cameraName = '';
  newCamera.latitude = '';
  newCamera.longitude = '';
  newCamera.photoURL = '';
  Object.keys(formErrors).forEach(key => formErrors[key] = '');
  document.getElementById('add_camera_modal').showModal();
};

// เพิ่มกล้อง
const handleAddCamera = async () => {
  if (!validateForm(newCamera)) {
    return;
  }

  // เช็คว่า cameraID ซ้ำหรือไม่
  const exists = cameras.value.some(c => c.cameraID === newCamera.cameraID.trim());
  if (exists) {
    formErrors.cameraID = 'Camera UID นี้มีในระบบแล้ว';
    return;
  }

  try {
    await addDoc(collection(db, "cameras"), {
      cameraID: newCamera.cameraID.trim(),
      cameraName: newCamera.cameraName.trim(),
      latitude: newCamera.latitude ? parseFloat(newCamera.latitude) : null,
      longitude: newCamera.longitude ? parseFloat(newCamera.longitude) : null,
      photoURL: newCamera.photoURL.trim() || null
    });

    document.getElementById('add_camera_modal').close();
    await fetchCameras();
    showToast('เพิ่มกล้องสำเร็จ ✅', 'success');
  } catch (e) {
    console.error("Error adding camera: ", e);
    alert("เกิดข้อผิดพลาดในการเพิ่มข้อมูล");
  }
};

// ลบกล้อง
const handleDeleteCamera = async (id, cameraID, cameraName) => {
  // เช็คว่ามี assignment หรือไม่
  if (isAssigned(cameraID)) {
    alert(`ไม่สามารถลบได้: กล้อง "${cameraName}" (${cameraID}) ถูกมอบหมายให้เจ้าหน้าที่แล้ว\nกรุณาลบ Assignment ก่อน`);
    return;
  }

  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบกล้อง "${cameraName}" (${cameraID})?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "cameras", id));
    await fetchCameras();
    showToast('ลบกล้องสำเร็จ ✅', 'success');
  } catch (e) {
    console.error("Error deleting camera: ", e);
    alert("เกิดข้อผิดพลาดในการลบข้อมูล");
  }
};

// เปิด Modal แก้ไข
const openEditModal = (camera) => {
  editingCamera.value = { ...camera };
  Object.keys(formErrors).forEach(key => formErrors[key] = '');
  document.getElementById('edit_camera_modal').showModal();
};

// บันทึกการแก้ไข
const handleUpdateCamera = async () => {
  if (!editingCamera.value) return;

  if (!validateForm(editingCamera.value)) {
    return;
  }

  // เช็คว่า cameraID ซ้ำกับคนอื่นหรือไม่
  const exists = cameras.value.some(c => 
    c.id !== editingCamera.value.id && 
    c.cameraID === editingCamera.value.cameraID.trim()
  );
  if (exists) {
    formErrors.cameraID = 'Camera UID นี้มีในระบบแล้ว';
    return;
  }

  try {
    const docRef = doc(db, "cameras", editingCamera.value.id);
    await updateDoc(docRef, {
      cameraID: editingCamera.value.cameraID.trim(),
      cameraName: editingCamera.value.cameraName.trim(),
      latitude: editingCamera.value.latitude ? parseFloat(editingCamera.value.latitude) : null,
      longitude: editingCamera.value.longitude ? parseFloat(editingCamera.value.longitude) : null,
      photoURL: editingCamera.value.photoURL?.trim() || null
    });

    document.getElementById('edit_camera_modal').close();
    editingCamera.value = null;
    await fetchCameras();
    await fetchAssignments(); // รีเฟรช assignments ด้วย
    showToast('อัปเดตกล้องสำเร็จ ✅', 'success');
  } catch (e) {
    console.error("Error updating camera: ", e);
    alert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
  }
};

// Preview รูปภาพ
const openImagePreview = (url) => {
  previewImage.value = url;
  document.getElementById('image_preview_modal').showModal();
};

// Toast
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

// เปิดแผนที่
const openMap = (lat, lng) => {
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
};

// Copy to Clipboard
const copyToClipboard = async (text, successMessage = "คัดลอกแล้ว ✅") => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, "success");
  } catch (err) {
    console.error("Failed to copy:", err);
    showToast("ไม่สามารถคัดลอกได้ ❌", "error");
  }
};

// --- Lifecycle ---
onMounted(async () => {
  loading.value = true;
  await Promise.all([
    fetchCameras(),
    fetchAssignments(),
    fetchOfficers()
  ]);
  loading.value = false;
});
</script>

<template>
  <div class="py-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">จัดการรายการกล้อง</h2>
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
        <button @click="openAddModal" class="btn btn-primary gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          เพิ่มกล้อง
        </button>
      </div>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
    </div>

    <!-- Search & Sort -->
    <div class="card bg-base-100 shadow-md mb-6">
      <div class="card-body p-4">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="form-control flex-1">
            <div class="input-group">

              <input
                v-model="searchQuery"
                type="text"
                placeholder="ค้นหา UID หรือจุดติดตั้ง..."
                class="input input-bordered flex-1"
              />
            </div>
          </div>

          <div class="form-control">
            <select v-model="sortBy" class="select select-bordered">
              <option value="cameraID">เรียงตาม: Camera UID</option>
              <option value="cameraName">เรียงตาม: จุดติดตั้ง</option>
              <option value="status">เรียงตาม: สถานะ</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Camera Grid -->
    <div v-else-if="filteredCameras.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="camera in filteredCameras"
        :key="camera.id"
        class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <figure v-if="camera.photoURL" class="relative h-48 bg-base-200">
          <img 
            :src="camera.photoURL" 
            :alt="camera.cameraName"
            class="w-full h-full object-cover cursor-pointer"
            @click="openImagePreview(camera.photoURL)"
            @error="(e) => e.target.style.display = 'none'"
          />
          <div class="absolute top-2 right-2">
            <button 
              @click="openImagePreview(camera.photoURL)"
              class="btn btn-circle btn-sm btn-ghost bg-base-100/70 backdrop-blur"
            >
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
          <!-- Status Badge -->
          <div class="flex justify-between items-start mb-2">
            <div class="badge badge-lg gap-2" :class="isAssigned(camera.cameraID) ? 'badge-success' : 'badge-warning'">
              <svg v-if="isAssigned(camera.cameraID)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ isAssigned(camera.cameraID) ? 'มอบหมายแล้ว' : 'ยังไม่มอบหมาย' }}
            </div>
          </div>

          <!-- Camera Info -->
          <h2 class="card-title text-lg">{{ camera.cameraName }}</h2>
          <p class="text-sm text-base-content/70">
            <span class="font-semibold">UID: </span> 
            <button
                    @click="
                      copyToClipboard(
                        camera.cameraID,
                        `คัดลอก ${camera.cameraID} แล้ว ✅`
                      )
                    "
                    class="badge badge-info hover:badge-primary transition-colors cursor-pointer"
                    title="คลิกเพื่อคัดลอก"
                  >
                    {{ camera.cameraID }}
                  </button>
          </p>

          <!-- Assigned Officer -->
          <p v-if="isAssigned(camera.cameraID)" class="text-sm text-base-content/70">
            <span class="font-semibold">เจ้าหน้าที่:</span> {{ getAssignedOfficer(camera.cameraID) }}
          </p>

          <!-- Location -->
          <div v-if="camera.latitude && camera.longitude" class="flex items-center gap-2 text-sm">
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

          <div class="divider my-2"></div>

          <!-- Actions -->
          <div class="card-actions justify-end">
            <button @click="openEditModal(camera)" class="btn btn-warning btn-sm gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              แก้ไข
            </button>
            <button 
              @click="handleDeleteCamera(camera.id, camera.cameraID, camera.cameraName)" 
              class="btn btn-error btn-sm gap-2"
              :disabled="isAssigned(camera.cameraID)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              ลบ
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-20">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <h3 class="text-xl font-bold mb-2">ไม่พบข้อมูลกล้อง</h3>
      <p class="text-base-content/70 mb-4">
        {{ searchQuery ? 'ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา' : 'ยังไม่มีกล้องในระบบ' }}
      </p>
      <button v-if="!searchQuery" @click="openAddModal" class="btn btn-primary">
        เพิ่มกล้องตัวแรก
      </button>
    </div>

    <!-- Modal: Add Camera -->
    <dialog id="add_camera_modal" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-2xl mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มกล้องใหม่
        </h3>

        <form @submit.prevent="handleAddCamera" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Camera UID -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">Camera UID <span class="text-error">*</span></span>
              </label>
              <input
                v-model="newCamera.cameraID"
                type="text"
                placeholder="CAM-001"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.cameraID }"
                required
              />
              <label v-if="formErrors.cameraID" class="label">
                <span class="label-text-alt text-error">{{ formErrors.cameraID }}</span>
              </label>
            </div>

            <!-- Camera Name -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">จุดติดตั้ง <span class="text-error">*</span></span>
              </label>
              <input
                v-model="newCamera.cameraName"
                type="text"
                placeholder="กล้องหน้าห้องขัง A1"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.cameraName }"
                required
              />
              <label v-if="formErrors.cameraName" class="label">
                <span class="label-text-alt text-error">{{ formErrors.cameraName }}</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Latitude -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">ละติจูด (Latitude)</span>
              </label>
              <input
                v-model="newCamera.latitude"
                type="number"
                step="any"
                placeholder="7.0067"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.latitude }"
              />
              <label v-if="formErrors.latitude" class="label">
                <span class="label-text-alt text-error">{{ formErrors.latitude }}</span>
              </label>
              <label v-else class="label">
                <span class="label-text-alt">ค่าระหว่าง -90 ถึง 90</span>
              </label>
            </div>

            <!-- Longitude -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">ลองจิจูด (Longitude)</span>
              </label>
              <input
                v-model="newCamera.longitude"
                type="number"
                step="any"
                placeholder="100.4925"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.longitude }"
              />
              <label v-if="formErrors.longitude" class="label">
                <span class="label-text-alt text-error">{{ formErrors.longitude }}</span>
              </label>
              <label v-else class="label">
                <span class="label-text-alt">ค่าระหว่าง -180 ถึง 180</span>
              </label>
            </div>
          </div>

          <!-- Photo URL -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">URL ภาพมุมกล้อง</span>
            </label>
            <input
              v-model="newCamera.photoURL"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="input input-bordered"
              :class="{ 'input-error': formErrors.photoURL }"
            />
            <label v-if="formErrors.photoURL" class="label">
              <span class="label-text-alt text-error">{{ formErrors.photoURL }}</span>
            </label>
            <label v-else class="label">
              <span class="label-text-alt">URL ของภาพมุมกล้อง (ไม่บังคับ)</span>
            </label>
          </div>

          <!-- Actions -->
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="add_camera_modal.close()">
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              เพิ่มกล้อง
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Modal: Edit Camera -->
    <dialog id="edit_camera_modal" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-2xl mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          แก้ไขข้อมูลกล้อง
        </h3>

        <form
          v-if="editingCamera"
          @submit.prevent="handleUpdateCamera"
          class="space-y-4"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Camera UID -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">Camera UID <span class="text-error">*</span></span>
              </label>
              <input
                v-model="editingCamera.cameraID"
                type="text"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.cameraID }"
                required
              />
              <label v-if="formErrors.cameraID" class="label">
                <span class="label-text-alt text-error">{{ formErrors.cameraID }}</span>
              </label>
            </div>

            <!-- Camera Name -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">จุดติดตั้ง <span class="text-error">*</span></span>
              </label>
              <input
                v-model="editingCamera.cameraName"
                type="text"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.cameraName }"
                required
              />
              <label v-if="formErrors.cameraName" class="label">
                <span class="label-text-alt text-error">{{ formErrors.cameraName }}</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Latitude -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">ละติจูด (Latitude)</span>
              </label>
              <input
                v-model="editingCamera.latitude"
                type="number"
                step="any"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.latitude }"
              />
              <label v-if="formErrors.latitude" class="label">
                <span class="label-text-alt text-error">{{ formErrors.latitude }}</span>
              </label>
            </div>

            <!-- Longitude -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">ลองจิจูด (Longitude)</span>
              </label>
              <input
                v-model="editingCamera.longitude"
                type="number"
                step="any"
                class="input input-bordered"
                :class="{ 'input-error': formErrors.longitude }"
              />
              <label v-if="formErrors.longitude" class="label">
                <span class="label-text-alt text-error">{{ formErrors.longitude }}</span>
              </label>
            </div>
          </div>

          <!-- Photo URL -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">URL ภาพมุมกล้อง</span>
            </label>
            <input
              v-model="editingCamera.photoURL"
              type="url"
              class="input input-bordered"
              :class="{ 'input-error': formErrors.photoURL }"
            />
            <label v-if="formErrors.photoURL" class="label">
              <span class="label-text-alt text-error">{{ formErrors.photoURL }}</span>
            </label>
          </div>

          <!-- Warning if assigned -->
          <div v-if="isAssigned(editingCamera.cameraID)" class="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="text-sm">กล้องนี้ถูกมอบหมายแล้ว - การแก้ไขจะส่งผลต่อ Assignment</span>
          </div>

          <!-- Actions -->
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="edit_camera_modal.close()">
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-warning gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Modal: Image Preview -->
    <dialog id="image_preview_modal" class="modal">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4">ภาพมุมกล้อง</h3>
        <figure class="bg-base-200 rounded-lg overflow-hidden">
          <img :src="previewImage" alt="Camera View" class="w-full" />
        </figure>
        <div class="modal-action">
          <button class="btn" onclick="image_preview_modal.close()">ปิด</button>
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
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
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
</style>