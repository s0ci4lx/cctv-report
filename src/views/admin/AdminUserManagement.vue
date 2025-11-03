<script setup>
import { ref, onMounted, computed } from 'vue';
import { db } from '../../firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy
} from "firebase/firestore";

// --- State ---
const loading = ref(true);
const submitting = ref(false);

// Lists
const inspectors = ref([]);
const admins = ref([]);
const officers = ref([]);

// Forms
const newInspectorEmail = ref('');
const newInspectorName = ref('');
const newAdminEmail = ref('');
const newAdminName = ref('');

// Search
const searchQuery = ref('');

// --- Computed ---
const filteredOfficers = computed(() => {
  if (!searchQuery.value) return officers.value;
  
  const query = searchQuery.value.toLowerCase();
  return officers.value.filter(officer => 
    officer.email?.toLowerCase().includes(query) ||
    officer.name?.toLowerCase().includes(query)
  );
});

// --- Functions ---

// ดึงข้อมูลทั้งหมด
const fetchAllUsers = async () => {
  loading.value = true;
  try {
    console.log("Fetching all users...");
    
    const inspectorsSnap = await getDocs(collection(db, "inspectors"));
    inspectors.value = [];
    inspectorsSnap.forEach(doc => {
      inspectors.value.push({ id: doc.id, ...doc.data() });
    });

    const adminsSnap = await getDocs(collection(db, "admins"));
    admins.value = [];
    adminsSnap.forEach(doc => {
      admins.value.push({ id: doc.id, ...doc.data() });
    });

    const officersSnap = await getDocs(query(collection(db, "officers"), orderBy("name")));
    officers.value = [];
    officersSnap.forEach(doc => {
      officers.value.push(doc.data());
    });

    console.log("Data loaded successfully");

  } catch (e) {
    console.error("Error fetching users:", e);
    showToast("เกิดข้อผิดพลาดในการดึงข้อมูล", "error");
  } finally {
    loading.value = false;
  }
};

// เพิ่ม Inspector
const addInspector = async () => {
  if (!newInspectorEmail.value || !newInspectorName.value) {
    showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
    return;
  }

  // ตรวจสอบว่า email นี้เป็น officer ในระบบหรือไม่
  const isOfficer = officers.value.some(o => o.email === newInspectorEmail.value);
  if (!isOfficer) {
    showToast("Email นี้ไม่พบในรายการเจ้าหน้าที่", "error");
    return;
  }

  // ตรวจสอบว่าเป็น Inspector อยู่แล้วหรือไม่
  const existingInspector = inspectors.value.find(i => i.id === newInspectorEmail.value);
  if (existingInspector) {
    showToast("Email นี้เป็น Inspector อยู่แล้ว", "error");
    return;
  }

  submitting.value = true;
  try {
    await setDoc(doc(db, "inspectors", newInspectorEmail.value), {
      email: newInspectorEmail.value,
      name: newInspectorName.value,
      createdAt: new Date().toISOString(),
      isActive: true
    });

    showToast(`เพิ่ม Inspector ${newInspectorName.value} สำเร็จ`, "success");
    
    // Reset form
    newInspectorEmail.value = '';
    newInspectorName.value = '';
    
    // Refresh data
    await fetchAllUsers();
    
  } catch (e) {
    console.error("Error adding inspector:", e);
    showToast("เกิดข้อผิดพลาดในการเพิ่ม Inspector", "error");
  } finally {
    submitting.value = false;
  }
};

// ลบ Inspector
const removeInspector = async (email, name) => {
  if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบ Inspector "${name}"?`)) {
    return;
  }

  submitting.value = true;
  try {
    await deleteDoc(doc(db, "inspectors", email));
    showToast(`ลบ Inspector ${name} สำเร็จ`, "success");
    await fetchAllUsers();
  } catch (e) {
    console.error("Error removing inspector:", e);
    showToast("เกิดข้อผิดพลาดในการลบ Inspector", "error");
  } finally {
    submitting.value = false;
  }
};

// เพิ่ม Admin
const addAdmin = async () => {
  if (!newAdminEmail.value || !newAdminName.value) {
    showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
    return;
  }

  // ตรวจสอบว่า email นี้เป็น officer ในระบบหรือไม่
  const isOfficer = officers.value.some(o => o.email === newAdminEmail.value);
  if (!isOfficer) {
    showToast("Email นี้ไม่พบในรายการเจ้าหน้าที่", "error");
    return;
  }

  // ตรวจสอบว่าเป็น Admin อยู่แล้วหรือไม่
  const existingAdmin = admins.value.find(a => a.id === newAdminEmail.value);
  if (existingAdmin) {
    showToast("Email นี้เป็น Admin อยู่แล้ว", "error");
    return;
  }

  submitting.value = true;
  try {
    await setDoc(doc(db, "admins", newAdminEmail.value), {
      email: newAdminEmail.value,
      name: newAdminName.value,
      isAdmin: true,
      createdAt: new Date().toISOString()
    });

    showToast(`เพิ่ม Admin ${newAdminName.value} สำเร็จ`, "success");
    
    // Reset form
    newAdminEmail.value = '';
    newAdminName.value = '';
    
    // Refresh data
    await fetchAllUsers();
    
  } catch (e) {
    console.error("Error adding admin:", e);
    showToast("เกิดข้อผิดพลาดในการเพิ่ม Admin", "error");
  } finally {
    submitting.value = false;
  }
};

// ลบ Admin
const removeAdmin = async (email, name) => {
  if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบ Admin "${name}"?\n\n⚠️ การลบ Admin จะทำให้ผู้ใช้นี้ไม่สามารถเข้าถึงส่วนจัดการระบบได้อีก`)) {
    return;
  }

  submitting.value = true;
  try {
    await deleteDoc(doc(db, "admins", email));
    showToast(`ลบ Admin ${name} สำเร็จ`, "success");
    await fetchAllUsers();
  } catch (e) {
    console.error("Error removing admin:", e);
    showToast("เกิดข้อผิดพลาดในการลบ Admin", "error");
  } finally {
    submitting.value = false;
  }
};

// เลือก Officer จาก Quick Actions
const selectOfficerForInspector = (officer) => {
  newInspectorEmail.value = officer.email;
  newInspectorName.value = officer.name;
};

const selectOfficerForAdmin = (officer) => {
  newAdminEmail.value = officer.email;
  newAdminName.value = officer.name;
};

// ตรวจสอบว่า Officer เป็น Inspector หรือ Admin อยู่แล้วหรือไม่
const getOfficerRole = (email) => {
  const isAdmin = admins.value.some(a => a.id === email);
  const isInspector = inspectors.value.some(i => i.id === email);
  
  if (isAdmin && isInspector) return 'Admin + Inspector';
  if (isAdmin) return 'Admin';
  if (isInspector) return 'Inspector';
  return 'Officer';
};

const getRoleBadgeClass = (role) => {
  if (role.includes('Admin')) return 'badge-info';
  if (role.includes('Inspector')) return 'badge-secondary';
  return 'badge-ghost';
};

// Toast notification
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

// --- Lifecycle ---
onMounted(async () => {
  console.log("AdminUserManagement mounted");
  await fetchAllUsers();
});
</script>

<template>
  <div class="py-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">จัดการผู้ใช้งาน</h2>
        <p class="text-base-content/70">
          เพิ่ม/ลบ Inspector และ Admin ในระบบ
        </p>
      </div>

      <button @click="fetchAllUsers" class="btn btn-ghost gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        รีเฟรช
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else>
      <!-- Statistics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-info">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.25-2.25l-7.5 7.5L4.5 12" />
              </svg>
            </div>
            <div class="stat-title">Admin</div>
            <div class="stat-value text-info">{{ admins.length }}</div>
            <div class="stat-desc">ผู้ดูแลระบบ</div>
          </div>
        </div>

        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div class="stat-title">Inspector</div>
            <div class="stat-value text-secondary">{{ inspectors.length }}</div>
            <div class="stat-desc">ผู้ตรวจสอบ</div>
          </div>
        </div>

        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-neutral">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div class="stat-title">เจ้าหน้าที่ทั้งหมด</div>
            <div class="stat-value text-neutral">{{ officers.length }}</div>
            <div class="stat-desc">ในระบบ</div>
          </div>
        </div>
      </div>

      <!-- Forms Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Add Inspector Form -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-secondary gap-2 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              เพิ่ม Inspector
            </h3>

            <div class="space-y-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-semibold">Email</span>
                </label>
                <input 
                  v-model="newInspectorEmail" 
                  type="email" 
                  placeholder="inspector@company.com" 
                  class="input input-bordered w-full"
                  :disabled="submitting"
                />
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-semibold">ชื่อ</span>
                </label>
                <input 
                  v-model="newInspectorName" 
                  type="text" 
                  placeholder="นายตรวจสอบ ระบบ" 
                  class="input input-bordered w-full"
                  :disabled="submitting"
                />
              </div>
            </div>

            <div class="card-actions justify-end mt-6">
              <button 
                @click="addInspector" 
                class="btn btn-secondary gap-2 w-full sm:w-auto"
                :disabled="submitting || !newInspectorEmail || !newInspectorName"
              >
                <svg v-if="submitting" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                เพิ่ม Inspector
              </button>
            </div>
          </div>
        </div>

        <!-- Add Admin Form -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-info gap-2 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              เพิ่ม Admin
            </h3>

            <div class="space-y-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-semibold">Email</span>
                </label>
                <input 
                  v-model="newAdminEmail" 
                  type="email" 
                  placeholder="admin@company.com" 
                  class="input input-bordered w-full"
                  :disabled="submitting"
                />
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-semibold">ชื่อ</span>
                </label>
                <input 
                  v-model="newAdminName" 
                  type="text" 
                  placeholder="นายแอดมิน ระบบ" 
                  class="input input-bordered w-full"
                  :disabled="submitting"
                />
              </div>
            </div>

            <div class="card-actions justify-end mt-6">
              <button 
                @click="addAdmin" 
                class="btn btn-info gap-2 w-full sm:w-auto"
                :disabled="submitting || !newAdminEmail || !newAdminName"
              >
                <svg v-if="submitting" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                เพิ่ม Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Current Users Lists -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Current Inspectors -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-secondary">Inspector ปัจจุบัน ({{ inspectors.length }})</h3>
            
            <div v-if="inspectors.length === 0" class="text-center py-8 text-base-content/50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p>ยังไม่มี Inspector</p>
            </div>

            <div v-else class="space-y-3">
              <div 
                v-for="inspector in inspectors" 
                :key="inspector.id"
                class="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <div class="avatar placeholder">
                    <div class="bg-secondary text-secondary-content rounded-full w-10">
                      <span class="text-xs">{{ inspector.name?.charAt(0) || '?' }}</span>
                    </div>
                  </div>
                  <div>
                    <div class="font-semibold">{{ inspector.name || 'ไม่ระบุชื่อ' }}</div>
                    <div class="text-sm text-base-content/70">{{ inspector.email }}</div>
                  </div>
                </div>
                
                <button 
                  @click="removeInspector(inspector.id, inspector.name || inspector.email)"
                  class="btn btn-sm btn-error btn-outline gap-2"
                  :disabled="submitting"
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

        <!-- Current Admins -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-info">Admin ปัจจุบัน ({{ admins.length }})</h3>
            
            <div v-if="admins.length === 0" class="text-center py-8 text-base-content/50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.25-2.25l-7.5 7.5L4.5 12" />
              </svg>
              <p>ยังไม่มี Admin</p>
            </div>

            <div v-else class="space-y-3">
              <div 
                v-for="admin in admins" 
                :key="admin.id"
                class="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <div class="avatar placeholder">
                    <div class="bg-info text-info-content rounded-full w-10">
                      <span class="text-xs">{{ admin.name?.charAt(0) || '?' }}</span>
                    </div>
                  </div>
                  <div>
                    <div class="font-semibold">{{ admin.name || 'ไม่ระบุชื่อ' }}</div>
                    <div class="text-sm text-base-content/70">{{ admin.email }}</div>
                  </div>
                </div>
                
                <button 
                  @click="removeAdmin(admin.id, admin.name || admin.email)"
                  class="btn btn-sm btn-error btn-outline gap-2"
                  :disabled="submitting"
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
      </div>

      <!-- All Officers Section -->
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <h3 class="card-title mb-4">เจ้าหน้าที่ทั้งหมดในระบบ</h3>

          <!-- Search -->
          <div class="form-control mb-4">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="ค้นหาชื่อหรือ email..." 
              class="input input-bordered"
            />
          </div>

          <!-- Desktop Table View (แสดงเฉพาะใน desktop) -->
          <div class="overflow-x-auto hidden md:block">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>Email</th>
                  <th>Role ปัจจุบัน</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="officer in filteredOfficers" :key="officer.email">
                  <td class="font-medium">{{ officer.name }}</td>
                  <td>{{ officer.email }}</td>
                  <td>
                    <span class="badge" :class="getRoleBadgeClass(getOfficerRole(officer.email))">
                      {{ getOfficerRole(officer.email) }}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button 
                        @click="selectOfficerForInspector(officer)"
                        class="btn btn-xs btn-secondary"
                        :disabled="getOfficerRole(officer.email).includes('Inspector')"
                      >
                        → Inspector
                      </button>
                      <button 
                        @click="selectOfficerForAdmin(officer)"
                        class="btn btn-xs btn-info"
                        :disabled="getOfficerRole(officer.email).includes('Admin')"
                      >
                        → Admin
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View (แสดงเฉพาะใน mobile) -->
          <div class="grid grid-cols-1 gap-3 md:hidden">
            <div 
              v-for="officer in filteredOfficers" 
              :key="officer.email"
              class="card bg-base-200 compact"
            >
              <div class="card-body">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3 flex-1">
                    <div class="avatar placeholder">
                      <div class="bg-neutral text-neutral-content rounded-full w-10">
                        <span class="text-xs">{{ officer.name?.charAt(0) || '?' }}</span>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold truncate">{{ officer.name }}</div>
                      <div class="text-sm text-base-content/70 truncate">{{ officer.email }}</div>
                      <div class="mt-1">
                        <span class="badge badge-sm" :class="getRoleBadgeClass(getOfficerRole(officer.email))">
                          {{ getOfficerRole(officer.email) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex gap-2 mt-3">
                  <button 
                    @click="selectOfficerForInspector(officer)"
                    class="btn btn-xs btn-secondary flex-1"
                    :disabled="getOfficerRole(officer.email).includes('Inspector')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Inspector
                  </button>
                  <button 
                    @click="selectOfficerForAdmin(officer)"
                    class="btn btn-xs btn-info flex-1"
                    :disabled="getOfficerRole(officer.email).includes('Admin')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.25-2.25l-7.5 7.5L4.5 12" />
                    </svg>
                    Admin
                  </button>
                </div>
              </div>
            </div>

            <!-- Empty State for Mobile -->
            <div v-if="filteredOfficers.length === 0" class="text-center py-8 text-base-content/50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>ไม่พบเจ้าหน้าที่ที่ค้นหา</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table {
  font-size: 0.875rem;
}
</style>