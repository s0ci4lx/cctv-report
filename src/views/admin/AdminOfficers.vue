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
import { useDialog } from "../../composables/useDialog.js"; // 👈 เพิ่ม Import

// 👇 ใช้ composable
const { showConfirm, showAlert, showToast } = useDialog();
// --- State (ตัวแปร) ---
const officers = ref([]);
const assignments = ref([]); // เก็บข้อมูล assignments เพื่อนับสถิติ
const loading = ref(true);
const searchQuery = ref('');
const sortBy = ref('name'); // name, email, cameras

// State สำหรับ "ฟอร์มเพิ่ม"
const newOfficer = reactive({
  name: "",
  email: "",
});

// State สำหรับ "ฟอร์มแก้ไข"
const editingOfficer = ref(null);

// State สำหรับ Validation
const formErrors = reactive({
  name: "",
  email: "",
});

// --- Computed Properties ---
const totalOfficers = computed(() => officers.value.length);

// สถิติภาพรวม
const stats = computed(() => {
  const totalAssignments = assignments.value.length;
  const avgCamerasPerOfficer = totalOfficers.value > 0 
    ? (totalAssignments / totalOfficers.value).toFixed(1) 
    : 0;
  
  return {
    total: totalOfficers.value,
    totalAssignments,
    avgCamerasPerOfficer
  };
});

// กรองและเรียงลำดับ
const filteredOfficers = computed(() => {
  let result = officers.value;

  // กรองตามคำค้นหา
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (officer) =>
        officer.name.toLowerCase().includes(query) ||
        officer.email.toLowerCase().includes(query)
    );
  }

  // เรียงลำดับ
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name, 'th');
    } else if (sortBy.value === 'email') {
      return a.email.localeCompare(b.email);
    } else if (sortBy.value === 'cameras') {
      return (b.assignmentCount || 0) - (a.assignmentCount || 0);
    }
    return 0;
  });

  return result;
});

// --- Functions (การทำงาน) ---

// ดึงข้อมูล Assignments เพื่อนับสถิติ
const fetchAssignments = async () => {
  try {
    const q = query(collection(db, "assignments"));
    const querySnapshot = await getDocs(q);
    const fetchedAssignments = [];
    querySnapshot.forEach((doc) => {
      fetchedAssignments.push({ id: doc.id, ...doc.data() });
    });
    assignments.value = fetchedAssignments;

    // นับจำนวน assignments ของแต่ละคน
    officers.value.forEach(officer => {
      officer.assignmentCount = assignments.value.filter(
        a => a.officerEmail === officer.email
      ).length;
    });
  } catch (e) {
    console.error("Error fetching assignments: ", e);
  }
};

// (R) READ: ดึงข้อมูลเจ้าหน้าที่
// ✅ แก้ไข fetchOfficers
const fetchOfficers = async () => {
  loading.value = true;
  officers.value = [];
  try {
    const q = query(collection(db, "officers"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      officers.value.push({ id: doc.id, ...doc.data(), assignmentCount: 0 });
    });

    await fetchAssignments();
  } catch (e) {
    console.error("Error fetching officers: ", e);
    showAlert("เกิดข้อผิดพลาดในการดึงข้อมูลเจ้าหน้าที่", { type: 'error' }); // 👈 เปลี่ยนจาก alert()
  } finally {
    loading.value = false;
  }
};

// Validation Function
const validateForm = (data) => {
  formErrors.name = "";
  formErrors.email = "";
  let isValid = true;

  if (!data.name || data.name.trim().length < 2) {
    formErrors.name = "กรุณากรอกชื่อ-สกุลอย่างน้อย 2 ตัวอักษร";
    isValid = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    formErrors.email = "กรุณากรอกอีเมลที่ถูกต้อง";
    isValid = false;
  }

  return isValid;
};

// ฟังก์ชันเปิด Modal "เพิ่ม"
const openAddModal = () => {
  // เคลียร์ฟอร์มและ errors
  newOfficer.name = "";
  newOfficer.email = "";
  formErrors.name = "";
  formErrors.email = "";
  document.getElementById("add_officer_modal").showModal();
};

// (C) CREATE: เพิ่มเจ้าหน้าที่
// ✅ แก้ไข handleAddOfficer
const handleAddOfficer = async () => {
  if (!validateForm(newOfficer)) {
    return;
  }

  const emailExists = officers.value.some(
    (officer) => officer.email.toLowerCase() === newOfficer.email.toLowerCase()
  );
  if (emailExists) {
    formErrors.email = "อีเมลนี้มีอยู่ในระบบแล้ว";
    return;
  }

  try {
    await addDoc(collection(db, "officers"), {
      name: newOfficer.name.trim(),
      email: newOfficer.email.trim(),
    });

    document.getElementById("add_officer_modal").close();
    await fetchOfficers();
    showToast("เพิ่มเจ้าหน้าที่สำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error adding document: ", e);
    showAlert("เกิดข้อผิดพลาดในการเพิ่มข้อมูล", { type: 'error' }); // 👈 เปลี่ยนจาก alert()
  }
};

// (D) DELETE: ลบ
// ✅ แก้ไข handleDeleteOfficer
const handleDeleteOfficer = async (id, name, email) => {
  const hasAssignments = assignments.value.some(a => a.officerEmail === email);
  
  if (hasAssignments) {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบเจ้าหน้าที่',
      message: `เจ้าหน้าที่ <strong>"${name}"</strong> มีงานที่มอบหมายอยู่<br/><br/>หากลบจะทำให้งานเหล่านั้นไม่มีผู้รับผิดชอบ<br/><br/>คุณแน่ใจหรือไม่ที่จะลบ?`,
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      type: 'error'
    }); // 👈 เปลี่ยนจาก confirm()
    
    if (!confirmed) return;
  } else {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบเจ้าหน้าที่',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบเจ้าหน้าที่<br/><strong>"${name}"</strong>?`,
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      type: 'error'
    }); // 👈 เปลี่ยนจาก confirm()
    
    if (!confirmed) return;
  }

  try {
    await deleteDoc(doc(db, "officers", id));
    await fetchOfficers();
    showToast("ลบเจ้าหน้าที่สำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error deleting document: ", e);
    showAlert("เกิดข้อผิดพลาดในการลบข้อมูล", { type: 'error' }); // 👈 เปลี่ยนจาก alert()
  }
};

// (U) UPDATE Step 1: เปิด Modal "แก้ไข"
const openEditModal = (officer) => {
  editingOfficer.value = { ...officer };
  formErrors.name = "";
  formErrors.email = "";
  document.getElementById("edit_officer_modal").showModal();
};

// (U) UPDATE Step 2: บันทึก
// ✅ แก้ไข handleUpdateOfficer
const handleUpdateOfficer = async () => {
  if (!editingOfficer.value) return;

  if (!validateForm(editingOfficer.value)) {
    return;
  }

  const emailExists = officers.value.some(
    (officer) =>
      officer.id !== editingOfficer.value.id &&
      officer.email.toLowerCase() === editingOfficer.value.email.toLowerCase()
  );
  if (emailExists) {
    formErrors.email = "อีเมลนี้มีอยู่ในระบบแล้ว";
    return;
  }

  try {
    const docRef = doc(db, "officers", editingOfficer.value.id);
    const dataToUpdate = {
      name: editingOfficer.value.name.trim(),
      email: editingOfficer.value.email.trim(),
    };

    await updateDoc(docRef, dataToUpdate);

    document.getElementById("edit_officer_modal").close();
    editingOfficer.value = null;

    await fetchOfficers();
    showToast("อัปเดตข้อมูลสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error updating document: ", e);
    showAlert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล", { type: 'error' }); // 👈 เปลี่ยนจาก alert()
  }
};

// สร้าง Initial สำหรับ Avatar
const getInitial = (name) => {
  if (!name) return "?";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
};

// สร้างสีแบบสุ่มตาม email
const getAvatarColor = (email) => {
  const colors = [
    'bg-primary',
    'bg-secondary',
    'bg-accent',
    'bg-info',
    'bg-success',
    'bg-warning',
    'bg-error',
  ];
  const index = email.charCodeAt(0) % colors.length;
  return colors[index];
};

// --- Lifecycle ---
onMounted(() => {
  fetchOfficers();
});
</script>

<template>
  <div class="py-6">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">จัดการรายชื่อเจ้าหน้าที่</h2>
        <p class="text-base-content/70">
          รายชื่อเจ้าหน้าที่ทั้งหมด ({{ totalOfficers }} รายการ)
        </p>
      </div>

      <div class="flex gap-2">
        <button @click="fetchOfficers" class="btn btn-ghost gap-2">
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
          เพิ่มเจ้าหน้าที่
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div class="stat-title">จำนวนเจ้าหน้าที่</div>
          <div class="stat-value text-primary">{{ stats.total }}</div>
          <div class="stat-desc">ผู้ปฏิบัติงานในระบบ</div>
        </div>
      </div>

      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="stat-title">กล้องทั้งหมด</div>
          <div class="stat-value text-secondary">{{ stats.totalAssignments }}</div>
          <div class="stat-desc">จุดที่มอบหมาย</div>
        </div>
      </div>

      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div class="stat-title">เฉลี่ยต่อคน</div>
          <div class="stat-value text-accent">{{ stats.avgCamerasPerOfficer }}</div>
          <div class="stat-desc">กล้อง/คน</div>
        </div>
      </div>
    </div>

    <!-- Search and Sort Bar -->
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
                placeholder="ค้นหาชื่อ หรืออีเมล..."
                class="input input-bordered flex-1"
              />
            </div>
          </div>

          <!-- Sort Dropdown -->
          <div class="form-control">
            <select v-model="sortBy" class="select select-bordered">
              <option value="name">เรียงตาม: ชื่อ (ก-ฮ)</option>
              <option value="email">เรียงตาม: อีเมล</option>
              <option value="cameras">เรียงตาม: จำนวนกล้อง</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Officers Grid -->
    <div v-else-if="filteredOfficers.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="item in filteredOfficers"
        :key="item.id"
        class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <div class="card-body">
          <!-- Avatar & Info -->
          <div class="flex items-start gap-4 mb-4">
            <div class="avatar placeholder">
              <div :class="`${getAvatarColor(item.email)} text-neutral-content rounded-full w-16 h-16`">
                <span class="text-2xl font-bold">{{ getInitial(item.name) }}</span>
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-lg truncate">{{ item.name }}</h3>
              <p class="text-sm text-base-content/70 truncate">{{ item.email }}</p>
              
              <!-- Stats Badge -->
              <div class="mt-2">
                <div class="badge badge-outline gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {{ item.assignmentCount || 0 }} กล้อง
                </div>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="divider my-0"></div>

          <!-- Action Buttons -->
          <div class="card-actions justify-end mt-2">
            <button
              @click="openEditModal(item)"
              class="btn btn-sm btn-warning gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              แก้ไข
            </button>
            <button
              @click="handleDeleteOfficer(item.id, item.name, item.email)"
              class="btn btn-sm btn-error gap-2"
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <h3 class="text-xl font-bold mb-2">ไม่พบข้อมูลเจ้าหน้าที่</h3>
      <p class="text-base-content/70 mb-4">
        {{ searchQuery ? 'ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา' : 'ยังไม่มีเจ้าหน้าที่ในระบบ' }}
      </p>
      <button v-if="!searchQuery" @click="openAddModal" class="btn btn-primary">
        เพิ่มเจ้าหน้าที่คนแรก
      </button>
    </div>

    <!-- Modal: Add Officer -->
    <dialog id="add_officer_modal" class="modal">
      <div class="modal-box max-w-md">
        <h3 class="font-bold text-2xl mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          เพิ่มเจ้าหน้าที่ใหม่
        </h3>

        <form @submit.prevent="handleAddOfficer" class="space-y-4">
          <!-- Name Field -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">ชื่อ-สกุล <span class="text-error">*</span></span>
            </label>
            <input
              v-model="newOfficer.name"
              type="text"
              placeholder="เช่น จ.ส.ต. สมชาย ใจดี"
              class="input input-bordered w-full"
              :class="{ 'input-error': formErrors.name }"
            />
            <label v-if="formErrors.name" class="label">
              <span class="label-text-alt text-error">{{ formErrors.name }}</span>
            </label>
          </div>

          <!-- Email Field -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">อีเมล <span class="text-error">*</span></span>
            </label>
            <input
              v-model="newOfficer.email"
              type="email"
              placeholder="example@police.go.th"
              class="input input-bordered w-full"
              :class="{ 'input-error': formErrors.email }"
            />
            <label v-if="formErrors.email" class="label">
              <span class="label-text-alt text-error">{{ formErrors.email }}</span>
            </label>
            <label v-else class="label">
              <span class="label-text-alt">ใช้สำหรับเข้าสู่ระบบด้วย Google</span>
            </label>
          </div>

          <!-- Info Alert -->
          <div class="alert alert-info shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span class="text-sm">อีเมลต้องตรงกับ Google Account ที่ใช้ล็อกอิน</span>
          </div>

          <!-- Action Buttons -->
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="add_officer_modal.close()">
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              เพิ่มเจ้าหน้าที่
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Modal: Edit Officer -->
    <dialog id="edit_officer_modal" class="modal">
      <div class="modal-box max-w-md">
        <h3 class="font-bold text-2xl mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          แก้ไขข้อมูลเจ้าหน้าที่
        </h3>

        <form
          v-if="editingOfficer"
          @submit.prevent="handleUpdateOfficer"
          class="space-y-4"
        >
          <!-- Name Field -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">ชื่อ-สกุล <span class="text-error">*</span></span>
            </label>
            <input
              v-model="editingOfficer.name"
              type="text"
              class="input input-bordered w-full"
              :class="{ 'input-error': formErrors.name }"
            />
            <label v-if="formErrors.name" class="label">
              <span class="label-text-alt text-error">{{ formErrors.name }}</span>
            </label>
          </div>

          <!-- Email Field -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">อีเมล <span class="text-error">*</span></span>
            </label>
            <input
              v-model="editingOfficer.email"
              type="email"
              class="input input-bordered w-full"
              :class="{ 'input-error': formErrors.email }"
            />
            <label v-if="formErrors.email" class="label">
              <span class="label-text-alt text-error">{{ formErrors.email }}</span>
            </label>
          </div>

          <!-- Warning Alert (if has assignments) -->
          <div v-if="editingOfficer.assignmentCount > 0" class="alert alert-warning shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="text-sm">เจ้าหน้าที่คนนี้มี {{ editingOfficer.assignmentCount }} กล้องที่ดูแลอยู่</span>
          </div>

          <!-- Action Buttons -->
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="edit_officer_modal.close()">
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
        <button>ปิด</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
/* Card Hover Effect */
.card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-4px);
}

/* Modal Animation */
.modal-box {
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>