<script setup>
import { ref, reactive, onMounted, computed, onUnmounted } from "vue";
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
} from "firebase/firestore";
import { useDialog } from "../../composables/useDialog.js";

const { showConfirm, showAlert, showToast } = useDialog();

// --- State ---
const cameras = ref([]);
const assignments = ref([]);
const officersList = ref([]);
const loading = ref(true);
const searchQuery = ref("");
const sortBy = ref("cameraID");
const viewMode = ref("cards");
const isLargeScreen = ref(true);
// 👇 เพิ่ม state สำหรับกรองประเภท
const filterCameraType = ref("all");
// เพิ่มใน state section
const filterAssignmentStatus = ref("all"); // all, assigned, unassigned
// 👇 เพิ่มตัวเลือกประเภทกล้อง
const cameraTypes = [
  { value: "4G", label: "4G", icon: "📡", color: "badge-primary" },
  { value: "WIFI", label: "WIFI", icon: "📶", color: "badge-info" },
  { value: "Tactical", label: "Tactical", icon: "🎯", color: "badge-warning" },
];

// State สำหรับฟอร์มเพิ่ม
const newCamera = reactive({
  cameraID: "",
  cameraName: "",
  cameraType: "4G", // 👈 เพิ่มฟิลด์นี้
  latitude: "",
  longitude: "",
  photoURL: "",
});

// State สำหรับฟอร์มแก้ไข
const editingCamera = ref(null);

// State สำหรับ Preview รูป
const previewImage = ref(null);

// State สำหรับ Validation
const formErrors = reactive({
  cameraID: "",
  cameraName: "",
  cameraType: "", // 👈 เพิ่มฟิลด์นี้
  latitude: "",
  longitude: "",
  photoURL: "",
});

// --- Computed ---
const totalCameras = computed(() => cameras.value.length);
const assignedCameras = computed(() => {
  const assignedIds = new Set(assignments.value.map((a) => a.cameraID));
  return cameras.value.filter((c) => assignedIds.has(c.cameraID)).length;
});
const unassignedCameras = computed(
  () => totalCameras.value - assignedCameras.value
);

const effectiveViewMode = computed(() => {
  return isLargeScreen.value ? viewMode.value : "cards";
});

// 👇 แก้ไข filteredCameras เพื่อรองรับการกรองตามประเภท
const filteredCameras = computed(() => {
  let result = cameras.value;

  // 👇 เพิ่มการกรองตามสถานะการมอบหมาย
  if (filterAssignmentStatus.value === "assigned") {
    result = result.filter((c) => isAssigned(c.cameraID));
  } else if (filterAssignmentStatus.value === "unassigned") {
    result = result.filter((c) => !isAssigned(c.cameraID));
  }

  // กรองตามประเภทกล้อง
  if (filterCameraType.value !== "all") {
    result = result.filter((c) => {
      const cameraType = c.cameraType || "4G";
      return cameraType === filterCameraType.value;
    });
  }

  // กรองตามคำค้นหา
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (c) =>
        c.cameraID.toLowerCase().includes(query) ||
        c.cameraName.toLowerCase().includes(query)
    );
  }

  // เรียงลำดับ
  result = [...result].sort((a, b) => {
    if (sortBy.value === "cameraID") {
      return a.cameraID.localeCompare(b.cameraID);
    } else if (sortBy.value === "cameraName") {
      return a.cameraName.localeCompare(b.cameraName, "th");
    } else if (sortBy.value === "status") {
      const aAssigned = isAssigned(a.cameraID);
      const bAssigned = isAssigned(b.cameraID);
      return bAssigned - aAssigned;
    }
    return 0;
  });

  return result;
});

// 👇 เพิ่มฟังก์ชันสำหรับคลิก Card
const filterByType = (type) => {
  // ถ้าคลิกซ้ำประเภทเดิม → ยกเลิกการกรอง
  if (filterCameraType.value === type) {
    filterCameraType.value = "all"; // กลับไปแสดงทั้งหมด
  } else {
    filterCameraType.value = type; // กรองตามประเภทใหม่
  }
};

// นับจำนวนกล้องแต่ละประเภท
const camera4GCount = computed(
  () => cameras.value.filter((c) => (c.cameraType || "4G") === "4G").length
);
const cameraWIFICount = computed(
  () => cameras.value.filter((c) => c.cameraType === "WIFI").length
);
const cameraTacticalCount = computed(
  () => cameras.value.filter((c) => c.cameraType === "Tactical").length
);
// --- Functions ---

// 👇 เพิ่มฟังก์ชันกรองสถานะการมอบหมาย
const filterByAssignmentStatus = (status) => {
  // ถ้าคลิกซ้ำสถานะเดิม → ยกเลิกการกรอง
  if (filterAssignmentStatus.value === status) {
    filterAssignmentStatus.value = "all";
  } else {
    filterAssignmentStatus.value = status;
  }
};

// 👇 ฟังก์ชันหาข้อมูล Camera Type
const getCameraTypeInfo = (type) => {
  return cameraTypes.find((t) => t.value === type) || cameraTypes[0];
};

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
    showAlert("เกิดข้อผิดพลาดในการดึงข้อมูลกล้อง", { type: "error" });
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
  return assignments.value.some((a) => a.cameraID === cameraID);
};

const getAssignedOfficer = (cameraID) => {
  const assignment = assignments.value.find((a) => a.cameraID === cameraID);
  if (!assignment) return null;

  const officer = officersList.value.find(
    (o) => o.email === assignment.officerEmail
  );
  return officer ? officer.name : assignment.officerEmail;
};

// 👇 แก้ไข Validation
const validateForm = (data) => {
  formErrors.cameraID = "";
  formErrors.cameraName = "";
  formErrors.cameraType = "";
  formErrors.latitude = "";
  formErrors.longitude = "";
  formErrors.photoURL = "";
  let isValid = true;

  if (!data.cameraID || data.cameraID.trim().length < 2) {
    formErrors.cameraID = "กรุณากรอก Camera UID อย่างน้อย 2 ตัวอักษร";
    isValid = false;
  }

  if (!data.cameraName || data.cameraName.trim().length < 2) {
    formErrors.cameraName = "กรุณากรอกจุดติดตั้งอย่างน้อย 2 ตัวอักษร";
    isValid = false;
  }

  if (!data.cameraType) {
    formErrors.cameraType = "กรุณาเลือกประเภทกล้อง";
    isValid = false;
  }

  if (
    data.latitude !== "" &&
    (isNaN(data.latitude) || data.latitude < -90 || data.latitude > 90)
  ) {
    formErrors.latitude = "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90";
    isValid = false;
  }

  if (
    data.longitude !== "" &&
    (isNaN(data.longitude) || data.longitude < -180 || data.longitude > 180)
  ) {
    formErrors.longitude = "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180";
    isValid = false;
  }

  if (data.photoURL && data.photoURL.trim() !== "") {
    try {
      new URL(data.photoURL);
    } catch {
      formErrors.photoURL = "กรุณากรอก URL ที่ถูกต้อง";
      isValid = false;
    }
  }

  return isValid;
};
// 👇 เพิ่ม methods สำหรับปิด modal
const closeAddModal = () => {
  const modal = document.getElementById("add_camera_modal");
  if (modal) {
    modal.close();
  }
};

const closeEditModal = () => {
  const modal = document.getElementById("edit_camera_modal");
  if (modal) {
    modal.close();
    editingCamera.value = null;
  }
};

// 👇 แก้ไข openAddModal
const openAddModal = () => {
  newCamera.cameraID = "";
  newCamera.cameraName = "";
  newCamera.cameraType = "4G";
  newCamera.latitude = "";
  newCamera.longitude = "";
  newCamera.photoURL = "";
  Object.keys(formErrors).forEach((key) => (formErrors[key] = ""));
  document.getElementById("add_camera_modal").showModal();
};

// 👇 แก้ไข handleAddCamera
const handleAddCamera = async () => {
  if (!validateForm(newCamera)) {
    return;
  }

  const exists = cameras.value.some(
    (c) => c.cameraID === newCamera.cameraID.trim()
  );
  if (exists) {
    formErrors.cameraID = "Camera UID นี้มีในระบบแล้ว";
    return;
  }

  try {
    await addDoc(collection(db, "cameras"), {
      cameraID: newCamera.cameraID.trim(),
      cameraName: newCamera.cameraName.trim(),
      cameraType: newCamera.cameraType,
      latitude: newCamera.latitude ? parseFloat(newCamera.latitude) : null,
      longitude: newCamera.longitude ? parseFloat(newCamera.longitude) : null,
      photoURL: newCamera.photoURL.trim() || null,
    });

    document.getElementById("add_camera_modal").close();
    await fetchCameras();
    showToast("เพิ่มกล้องสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error adding camera: ", e);
    showAlert("เกิดข้อผิดพลาดในการเพิ่มข้อมูล", { type: "error" });
  }
};

const handleDeleteCamera = async (id, cameraID, cameraName) => {
  if (isAssigned(cameraID)) {
    await showAlert(
      `ไม่สามารถลบได้: กล้อง <strong>"${cameraName}"</strong> (${cameraID}) ถูกมอบหมายให้เจ้าหน้าที่แล้ว<br/><br/>กรุณาลบ Assignment ก่อน`,
      {
        type: "warning",
        title: "ไม่สามารถลบได้",
      }
    );
    return;
  }

  const confirmed = await showConfirm({
    title: "ยืนยันการลบกล้อง",
    message: `คุณแน่ใจหรือไม่ว่าต้องการลบกล้อง<br/><strong>"${cameraName}"</strong><br/>(${cameraID})?`,
    confirmText: "ลบ",
    cancelText: "ยกเลิก",
    type: "error",
  });

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "cameras", id));
    await fetchCameras();
    showToast("ลบกล้องสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error deleting camera: ", e);
    showAlert("เกิดข้อผิดพลาดในการลบข้อมูล", { type: "error" });
  }
};

const openEditModal = (camera) => {
  editingCamera.value = { ...camera };
  Object.keys(formErrors).forEach((key) => (formErrors[key] = ""));
  document.getElementById("edit_camera_modal").showModal();
};

// 👇 แก้ไข handleUpdateCamera
const handleUpdateCamera = async () => {
  if (!editingCamera.value) return;

  if (!validateForm(editingCamera.value)) {
    return;
  }

  const exists = cameras.value.some(
    (c) =>
      c.id !== editingCamera.value.id &&
      c.cameraID === editingCamera.value.cameraID.trim()
  );
  if (exists) {
    formErrors.cameraID = "Camera UID นี้มีในระบบแล้ว";
    return;
  }

  try {
    const docRef = doc(db, "cameras", editingCamera.value.id);
    await updateDoc(docRef, {
      cameraID: editingCamera.value.cameraID.trim(),
      cameraName: editingCamera.value.cameraName.trim(),
      cameraType: editingCamera.value.cameraType,
      latitude: editingCamera.value.latitude
        ? parseFloat(editingCamera.value.latitude)
        : null,
      longitude: editingCamera.value.longitude
        ? parseFloat(editingCamera.value.longitude)
        : null,
      photoURL: editingCamera.value.photoURL?.trim() || null,
    });

    document.getElementById("edit_camera_modal").close();
    editingCamera.value = null;
    await fetchCameras();
    await fetchAssignments();
    showToast("อัปเดตกล้องสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error updating camera: ", e);
    showAlert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล", { type: "error" });
  }
};

const openImagePreview = (url) => {
  previewImage.value = url;
  document.getElementById("image_preview_modal").showModal();
};

const openMap = (lat, lng) => {
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
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

const updateScreenSize = () => {
  if (typeof window !== "undefined") {
    isLargeScreen.value = window.innerWidth >= 1024;
  }
};

onMounted(async () => {
  loading.value = true;

  updateScreenSize();

  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateScreenSize);
  }

  await Promise.all([fetchCameras(), fetchAssignments(), fetchOfficers()]);
  loading.value = false;
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", updateScreenSize);
  }
});
</script>

<template>
  <div class="py-6">
    <!-- Header -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
    >
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">
          จัดการรายการกล้อง
        </h2>
        <p class="text-base-content/70">
          กล้องวงจรปิดทั้งหมดในระบบ ({{ totalCameras }} ตัว)
        </p>
      </div>

      <div class="flex gap-2">
        <button
          @click="
            fetchCameras();
            fetchAssignments();
          "
          class="btn btn-ghost gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          รีเฟรช
        </button>
        <button @click="openAddModal" class="btn btn-primary gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          เพิ่มกล้อง
        </button>
      </div>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <!-- Card 1: Total - คลิกแสดงทั้งหมด -->
      <button
        @click="filterByType('all')"
        class="stats shadow bg-base-100 hover:shadow-xl transition-all cursor-pointer text-left"
        :class="{ 'ring-2 ring-primary': filterCameraType === 'all' }"
      >
        <div class="stat">
          <div class="stat-figure text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="inline-block w-8 h-8 stroke-current"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div class="stat-title">กล้องทั้งหมด</div>
          <div class="stat-value text-primary">{{ totalCameras }}</div>
          <div class="stat-desc">จำนวนกล้องในระบบ</div>
        </div>
      </button>

      <!-- Card 2: Assigned - คลิกกรองมอบหมายแล้ว -->
      <button
        @click="filterByAssignmentStatus('assigned')"
        class="stats shadow bg-base-100 hover:shadow-xl transition-all cursor-pointer text-left"
        :class="{
          'ring-2 ring-success': filterAssignmentStatus === 'assigned',
        }"
      >
        <div class="stat">
          <div class="stat-figure text-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="inline-block w-8 h-8 stroke-current"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div class="stat-title">มอบหมายแล้ว</div>
          <div class="stat-value text-success">{{ assignedCameras }}</div>
          <div class="stat-desc">
            {{
              totalCameras > 0
                ? Math.round((assignedCameras / totalCameras) * 100)
                : 0
            }}% ของทั้งหมด
          </div>
        </div>
      </button>

      <!-- Card 3: Unassigned - คลิกกรองยังไม่มอบหมาย -->
      <button
        @click="filterByAssignmentStatus('unassigned')"
        class="stats shadow bg-base-100 hover:shadow-xl transition-all cursor-pointer text-left"
        :class="{
          'ring-2 ring-warning': filterAssignmentStatus === 'unassigned',
        }"
      >
        <div class="stat">
          <div class="stat-figure text-warning">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="inline-block w-8 h-8 stroke-current"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div class="stat-title">ยังไม่มอบหมาย</div>
          <div class="stat-value text-warning">{{ unassignedCameras }}</div>
          <div class="stat-desc">รอการมอบหมาย</div>
        </div>
      </button>

      <!-- 👇 Card 4: 4G Cameras - คลิกกรอง 4G -->
      <button
        @click="filterByType('4G')"
        class="stats shadow bg-base-100 hover:shadow-xl transition-all cursor-pointer text-left"
        :class="{ 'ring-2 ring-primary': filterCameraType === '4G' }"
      >
        <div class="stat">
          <div class="stat-figure text-primary">
            <div class="text-4xl">📡</div>
          </div>
          <div class="stat-title">กล้อง 4G</div>
          <div class="stat-value text-primary">{{ camera4GCount }}</div>
          <div class="stat-desc">
            {{
              totalCameras > 0
                ? Math.round((camera4GCount / totalCameras) * 100)
                : 0
            }}% ของทั้งหมด
          </div>
        </div>
      </button>

      <!-- 👇 Card 5: WIFI Cameras - คลิกกรอง WIFI -->
      <button
        @click="filterByType('WIFI')"
        class="stats shadow bg-base-100 hover:shadow-xl transition-all cursor-pointer text-left"
        :class="{ 'ring-2 ring-info': filterCameraType === 'WIFI' }"
      >
        <div class="stat">
          <div class="stat-figure text-info">
            <div class="text-4xl">📶</div>
          </div>
          <div class="stat-title">กล้อง WIFI</div>
          <div class="stat-value text-info">{{ cameraWIFICount }}</div>
          <div class="stat-desc">
            {{
              totalCameras > 0
                ? Math.round((cameraWIFICount / totalCameras) * 100)
                : 0
            }}% ของทั้งหมด
          </div>
        </div>
      </button>

      <!-- 👇 Card 6: Tactical Cameras - คลิกกรอง Tactical -->
      <button
        @click="filterByType('Tactical')"
        class="stats shadow bg-base-100 hover:shadow-xl transition-all cursor-pointer text-left"
        :class="{ 'ring-2 ring-warning': filterCameraType === 'Tactical' }"
      >
        <div class="stat">
          <div class="stat-figure text-warning">
            <div class="text-4xl">🎯</div>
          </div>
          <div class="stat-title">กล้อง Tactical</div>
          <div class="stat-value text-warning">{{ cameraTacticalCount }}</div>
          <div class="stat-desc">
            {{
              totalCameras > 0
                ? Math.round((cameraTacticalCount / totalCameras) * 100)
                : 0
            }}% ของทั้งหมด
          </div>
        </div>
      </button>
    </div>

    <!-- Search & Sort Bar - 👇 เพิ่ม Dropdown กรอง -->
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

          <!-- 👇 เพิ่ม Dropdown กรองประเภท -->
          <div class="form-control">
            <select
              v-model="filterCameraType"
              class="select select-bordered w-full"
            >
              <option value="all">ทุกประเภท ({{ totalCameras }})</option>
              <option value="4G">📡 4G ({{ camera4GCount }})</option>
              <option value="WIFI">📶 WIFI ({{ cameraWIFICount }})</option>
              <option value="Tactical">
                🎯 Tactical ({{ cameraTacticalCount }})
              </option>
            </select>
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
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                การ์ด
              </button>
              <button
                class="join-item btn btn-sm gap-2"
                :class="{ 'btn-active': viewMode === 'table' }"
                @click="viewMode = 'table'"
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
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
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

    <!-- Table View (เฉพาะหน้าจอใหญ่) -->
    <div
      v-else-if="
        !loading &&
        filteredCameras.length > 0 &&
        effectiveViewMode === 'table' &&
        isLargeScreen
      "
      class="block"
    >
      <div class="card bg-base-100 shadow-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead class="bg-base-200">
              <tr>
                <th class="w-20">รูปภาพ</th>
                <th>ประเภท</th>
                <!-- 👈 เพิ่มคอลัมน์นี้ -->
                <th>Camera UID</th>
                <th>จุดติดตั้ง</th>
                <th class="w-20 text-center">สถานะ</th>
                <th>เจ้าหน้าที่</th>
                <th>พิกัด</th>
                <th class="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="camera in filteredCameras"
                :key="camera.id"
                class="hover"
              >
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
                        @error="(e) => (e.target.style.display = 'none')"
                      />
                      <div
                        v-else
                        class="w-full h-full bg-base-200 flex items-center justify-center"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-8 w-8 text-base-content/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- 👇 ประเภทกล้อง (เพิ่มใหม่) -->
                <td>
                  <div
                    class="badge badge-lg gap-2"
                    :class="getCameraTypeInfo(camera.cameraType || '4G').color"
                  >
                    <span>{{
                      getCameraTypeInfo(camera.cameraType || "4G").icon
                    }}</span>
                    <span class="text-xs font-semibold">{{
                      getCameraTypeInfo(camera.cameraType || "4G").label
                    }}</span>
                  </div>
                </td>

                <!-- Camera UID -->
                <td>
                  <button
                    @click="
                      copyToClipboard(
                        camera.cameraID,
                        `คัดลอก ${camera.cameraID} แล้ว ✅`
                      )
                    "
                    class="btn btn-soft btn-primary btn-sm hover:badge-primary transition-colors cursor-pointer"
                    title="คลิกเพื่อคัดลอก"
                  >
                    {{ camera.cameraID }}
                  </button>
                </td>

                <!-- จุดติดตั้ง -->
                <td>
                  <div class="font-bold">{{ camera.cameraName }}</div>
                </td>

                <!-- สถานะ (แค่ไอคอน) -->
                <td class="text-center">
                  <div
                    v-if="isAssigned(camera.cameraID)"
                    class="tooltip tooltip-success"
                    data-tip="มอบหมายแล้ว"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-6 w-6 text-success mx-auto"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div
                    v-else
                    class="tooltip tooltip-warning"
                    data-tip="ยังไม่มอบหมาย"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-6 w-6 text-warning mx-auto"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </td>

                <!-- เจ้าหน้าที่ -->
                <td>
                  <span v-if="isAssigned(camera.cameraID)" class="text-sm">
                    {{ getAssignedOfficer(camera.cameraID) }}
                  </span>
                  <span v-else class="text-base-content/50 text-sm">-</span>
                </td>

                <!-- พิกัด -->
                <td>
                  <div
                    v-if="camera.latitude && camera.longitude"
                    class="flex items-center gap-2 text-sm"
                  >
                    <button
                      @click="openMap(camera.latitude, camera.longitude)"
                      class="link link-primary text-xs flex items-center gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 text-error"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {{ camera.latitude.toFixed(4) }},
                      {{ camera.longitude.toFixed(4) }}
                    </button>
                  </div>
                  <span v-else class="text-base-content/50 text-sm">-</span>
                </td>

                <!-- จัดการ -->
                <td class="text-center">
                  <div class="join">
                    <button
                      @click="openEditModal(camera)"
                      class="btn btn-warning btn-xs gap-1 join-item"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      แก้ไข
                    </button>
                    <button
                      @click="
                        handleDeleteCamera(
                          camera.id,
                          camera.cameraID,
                          camera.cameraName
                        )
                      "
                      class="btn btn-error btn-xs gap-1 join-item"
                      :disabled="isAssigned(camera.cameraID)"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Card View -->
    <div
      v-else-if="!loading && filteredCameras.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
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
            @error="(e) => (e.target.style.display = 'none')"
          />
          <div class="absolute top-2 right-2">
            <button
              @click="openImagePreview(camera.photoURL)"
              class="btn btn-circle btn-sm btn-ghost bg-base-100/70 backdrop-blur"
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </figure>
        <figure
          v-else
          class="h-48 bg-base-200 flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-16 w-16 text-base-content/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </figure>

        <div class="card-body">
          <!-- 👇 เปลี่ยนจาก Avatar เป็น Badge แสดงประเภท -->
          <div class="flex justify-between items-start mb-4">
            <div class="flex flex-col gap-2">
              <!-- Badge ประเภทกล้อง -->
              <div
                class="badge badge-lg gap-2"
                :class="getCameraTypeInfo(camera.cameraType || '4G').color"
              >
                <span class="text-lg">{{
                  getCameraTypeInfo(camera.cameraType || "4G").icon
                }}</span>
                <span class="font-semibold">{{
                  getCameraTypeInfo(camera.cameraType || "4G").label
                }}</span>
              </div>
            </div>

            <!-- Status Badge -->
            <div
              class="badge badge-lg gap-2"
              :class="
                isAssigned(camera.cameraID) ? 'badge-success' : 'badge-warning'
              "
            >
              <svg
                v-if="isAssigned(camera.cameraID)"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <svg
                v-else
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {{
                isAssigned(camera.cameraID) ? "มอบหมายแล้ว" : "ยังไม่มอบหมาย"
              }}
            </div>
          </div>

          <!-- Camera Info -->
          <h2 class="card-title text-lg">{{ camera.cameraName }}</h2>
          <p class="text-sm text-base-content/70">
            <button
              @click="
                copyToClipboard(
                  camera.cameraID,
                  `คัดลอก ${camera.cameraID} แล้ว ✅`
                )
              "
              class="btn btn-soft btn-primary btn-sm hover:badge-primary transition-colors cursor-pointer"
              title="คลิกเพื่อคัดลอก"
            >
              <span class="font-semibold">UID: </span> {{ camera.cameraID }}
            </button>
          </p>

          <!-- Assigned Officer -->
          <p
            v-if="isAssigned(camera.cameraID)"
            class="text-sm text-base-content/70"
          >
            <span class="font-semibold">เจ้าหน้าที่:</span>
            {{ getAssignedOfficer(camera.cameraID) }}
          </p>

          <!-- Location -->
          <div
            v-if="camera.latitude && camera.longitude"
            class="flex items-center gap-2 text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <button
              @click="openMap(camera.latitude, camera.longitude)"
              class="link link-primary text-xs"
            >
              {{ camera.latitude.toFixed(4) }},
              {{ camera.longitude.toFixed(4) }}
            </button>
          </div>

          <div class="divider my-2"></div>

          <!-- Actions -->
          <div class="card-actions justify-end">
            <button
              @click="openEditModal(camera)"
              class="btn btn-warning btn-sm gap-2"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              แก้ไข
            </button>
            <button
              @click="
                handleDeleteCamera(
                  camera.id,
                  camera.cameraID,
                  camera.cameraName
                )
              "
              class="btn btn-error btn-sm gap-2"
              :disabled="isAssigned(camera.cameraID)"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              ลบ
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!loading && filteredCameras.length === 0"
      class="text-center py-20"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-24 w-24 mx-auto text-base-content/30 mb-4"
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
      <h3 class="text-xl font-bold mb-2">ไม่พบข้อมูลกล้อง</h3>
      <p class="text-base-content/70 mb-4">
        {{
          searchQuery ? "ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา" : "ยังไม่มีกล้องในระบบ"
        }}
      </p>
      <button v-if="!searchQuery" @click="openAddModal" class="btn btn-primary">
        เพิ่มกล้องตัวแรก
      </button>
    </div>

    <!-- Modal: Add Camera -->
    <dialog id="add_camera_modal" class="modal">
      <div class="modal-box max-w-3xl">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-base-300">
          <div class="p-3 bg-primary/10 rounded-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-2xl">เพิ่มกล้องใหม่</h3>
            <p class="text-sm text-base-content/60">
              กรอกข้อมูลกล้องวงจรปิดเพื่อเพิ่มเข้าสู่ระบบ
            </p>
          </div>
        </div>

        <form @submit.prevent="handleAddCamera" class="space-y-6">
          <!-- ข้อมูลพื้นฐาน -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h4 class="font-semibold text-lg">ข้อมูลพื้นฐาน</h4>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Camera UID -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium">
                    Camera UID <span class="text-error">*</span>
                  </span>
                </div>
                <input
                  v-model="newCamera.cameraID"
                  type="text"
                  placeholder="เช่น CAM-001"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': formErrors.cameraID }"
                  required
                />
                <div class="label" v-if="formErrors.cameraID">
                  <span
                    class="label-text-alt text-error flex items-center gap-1"
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
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {{ formErrors.cameraID }}
                  </span>
                </div>
              </label>

              <!-- Camera Type -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium">
                    ประเภทกล้อง <span class="text-error">*</span>
                  </span>
                </div>
                <select
                  v-model="newCamera.cameraType"
                  class="select select-bordered w-full"
                  :class="{ 'select-error': formErrors.cameraType }"
                  required
                >
                  <option
                    v-for="type in cameraTypes"
                    :key="type.value"
                    :value="type.value"
                  >
                    {{ type.icon }} {{ type.label }}
                  </option>
                </select>
                <div class="label" v-if="formErrors.cameraType">
                  <span
                    class="label-text-alt text-error flex items-center gap-1"
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
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {{ formErrors.cameraType }}
                  </span>
                </div>
              </label>
            </div>

            <!-- Camera Name (full width) -->
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">
                  จุดติดตั้ง <span class="text-error">*</span>
                </span>
              </div>
              <input
                v-model="newCamera.cameraName"
                type="text"
                placeholder="เช่น กล้องหน้าห้องขัง A1"
                class="input input-bordered w-full"
                :class="{ 'input-error': formErrors.cameraName }"
                required
              />
              <div class="label" v-if="formErrors.cameraName">
                <span class="label-text-alt text-error flex items-center gap-1">
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {{ formErrors.cameraName }}
                </span>
              </div>
            </label>
          </div>

          <div class="divider"></div>

          <!-- พิกัดที่ตั้ง -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h4 class="font-semibold text-lg">พิกัดที่ตั้ง</h4>
              <span class="text-xs font-normal text-base-content/60"
                >(ไม่บังคับ)</span
              >
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Latitude -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium">ละติจูด (Latitude)</span>
                </div>
                <input
                  v-model="newCamera.latitude"
                  type="number"
                  step="any"
                  placeholder="7.0067"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': formErrors.latitude }"
                />
                <div class="label">
                  <span
                    class="label-text-alt"
                    :class="formErrors.latitude ? 'text-error' : ''"
                  >
                    {{ formErrors.latitude || "ค่าระหว่าง -90 ถึง 90" }}
                  </span>
                </div>
              </label>

              <!-- Longitude -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium"
                    >ลองจิจูด (Longitude)</span
                  >
                </div>
                <input
                  v-model="newCamera.longitude"
                  type="number"
                  step="any"
                  placeholder="100.4925"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': formErrors.longitude }"
                />
                <div class="label">
                  <span
                    class="label-text-alt"
                    :class="formErrors.longitude ? 'text-error' : ''"
                  >
                    {{ formErrors.longitude || "ค่าระหว่าง -180 ถึง 180" }}
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div class="divider"></div>

          <!-- ภาพมุมกล้อง -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-info"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h4 class="font-semibold text-lg">ภาพมุมกล้อง</h4>
              <span class="text-xs font-normal text-base-content/60"
                >(ไม่บังคับ)</span
              >
            </div>

            <label class="form-control w-full">
              <label
                class="input input-bordered w-full"
                :class="{ 'input-error': formErrors.photoURL }"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 opacity-70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <input
                  v-model="newCamera.photoURL"
                  type="url"
                  class="grow"
                  placeholder="https://example.com/image.jpg"
                />
              </label>
            </label>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4 border-t border-base-300">
            <button
              type="button"
              class="btn btn-ghost flex-1"
              @click="closeAddModal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary flex-1 gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
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
      <div class="modal-box max-w-3xl">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-base-300">
          <div class="p-3 bg-warning/10 rounded-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-warning"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-2xl">แก้ไขข้อมูลกล้อง</h3>
            <p class="text-sm text-base-content/60">
              อัปเดตข้อมูลกล้องวงจรปิดในระบบ
            </p>
          </div>
        </div>

        <form
          v-if="editingCamera"
          @submit.prevent="handleUpdateCamera"
          class="space-y-6"
        >
          <!-- ข้อมูลพื้นฐาน -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h4 class="font-semibold text-lg">ข้อมูลพื้นฐาน</h4>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Camera UID -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium">
                    Camera UID <span class="text-error">*</span>
                  </span>
                </div>
                <input
                  v-model="editingCamera.cameraID"
                  type="text"
                  placeholder="เช่น CAM-001"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': formErrors.cameraID }"
                  required
                />
                <div class="label" v-if="formErrors.cameraID">
                  <span
                    class="label-text-alt text-error flex items-center gap-1"
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
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {{ formErrors.cameraID }}
                  </span>
                </div>
              </label>

              <!-- Camera Type -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium">
                    ประเภทกล้อง <span class="text-error">*</span>
                  </span>
                </div>
                <select
                  v-model="editingCamera.cameraType"
                  class="select select-bordered w-full"
                  :class="{ 'select-error': formErrors.cameraType }"
                  required
                >
                  <option
                    v-for="type in cameraTypes"
                    :key="type.value"
                    :value="type.value"
                  >
                    {{ type.icon }} {{ type.label }}
                  </option>
                </select>
                <div class="label" v-if="formErrors.cameraType">
                  <span
                    class="label-text-alt text-error flex items-center gap-1"
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
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {{ formErrors.cameraType }}
                  </span>
                </div>
              </label>
            </div>

            <!-- Camera Name (full width) -->
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">
                  จุดติดตั้ง <span class="text-error">*</span>
                </span>
              </div>
              <input
                v-model="editingCamera.cameraName"
                type="text"
                placeholder="เช่น กล้องหน้าห้องขัง A1"
                class="input input-bordered w-full"
                :class="{ 'input-error': formErrors.cameraName }"
                required
              />
              <div class="label" v-if="formErrors.cameraName">
                <span class="label-text-alt text-error flex items-center gap-1">
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {{ formErrors.cameraName }}
                </span>
              </div>
            </label>
          </div>

          <div class="divider"></div>

          <!-- พิกัดที่ตั้ง -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h4 class="font-semibold text-lg">พิกัดที่ตั้ง</h4>
              <span class="text-xs font-normal text-base-content/60"
                >(ไม่บังคับ)</span
              >
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Latitude -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium">ละติจูด (Latitude)</span>
                </div>
                <input
                  v-model="editingCamera.latitude"
                  type="number"
                  step="any"
                  placeholder="7.0067"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': formErrors.latitude }"
                />
                <div class="label">
                  <span
                    class="label-text-alt"
                    :class="formErrors.latitude ? 'text-error' : ''"
                  >
                    {{ formErrors.latitude || "ค่าระหว่าง -90 ถึง 90" }}
                  </span>
                </div>
              </label>

              <!-- Longitude -->
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text font-medium"
                    >ลองจิจูด (Longitude)</span
                  >
                </div>
                <input
                  v-model="editingCamera.longitude"
                  type="number"
                  step="any"
                  placeholder="100.4925"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': formErrors.longitude }"
                />
                <div class="label">
                  <span
                    class="label-text-alt"
                    :class="formErrors.longitude ? 'text-error' : ''"
                  >
                    {{ formErrors.longitude || "ค่าระหว่าง -180 ถึง 180" }}
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div class="divider"></div>

          <!-- ภาพมุมกล้อง -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-info"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h4 class="font-semibold text-lg">ภาพมุมกล้อง</h4>
              <span class="text-xs font-normal text-base-content/60"
                >(ไม่บังคับ)</span
              >
            </div>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">URL ภาพมุมกล้อง</span>
              </div>
              <input
                v-model="editingCamera.photoURL"
                type="url"
                placeholder="https://example.com/image.jpg"
                class="input input-bordered w-full"
                :class="{ 'input-error': formErrors.photoURL }"
              />
            </label>
          </div>

          <!-- Warning if assigned -->
          <div
            v-if="isAssigned(editingCamera.cameraID)"
            class="alert alert-warning"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span class="text-sm"
              >กล้องนี้ถูกมอบหมายแล้ว - การแก้ไขจะส่งผลต่อ Assignment</span
            >
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4 border-t border-base-300">
            <button
              type="button"
              class="btn btn-ghost flex-1"
              @click="closeEditModal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-warning flex-1 gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
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

    <!-- Image Preview Modal -->
    <dialog id="image_preview_modal" class="modal">
      <div class="modal-box max-w-4xl w-11/12">
        <h3 class="font-bold text-lg mb-4">ภาพมุมกล้อง</h3>
        <figure class="bg-base-200 rounded-lg overflow-hidden">
          <img
            v-if="previewImage"
            :src="previewImage"
            alt="Camera View"
            class="w-full"
          />
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
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-4px);
}
/* 👇 เพิ่ม style สำหรับ stat cards ที่คลิกได้ */
.stats.hover\:shadow-xl {
  transition: all 0.2s ease-in-out;
}

.stats.hover\:shadow-xl:hover {
  transform: translateY(-2px);
}

.stats.ring-2 {
  transform: translateY(-2px);
}
figure img {
  transition: transform 0.3s ease-in-out;
}

figure:hover img {
  transform: scale(1.05);
}

.table tbody tr:hover {
  background-color: hsl(var(--b2) / 0.5);
}

.join input[type="radio"]:checked {
  background-color: hsl(var(--p));
  color: hsl(var(--pc));
}
</style>
