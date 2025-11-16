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
} from "firebase/firestore";
import { useDialog } from "../../composables/useDialog.js";

const { showConfirm, showAlert, showToast } = useDialog();

// --- State ---
const assignments = ref([]);
const cameras = ref([]);
const officersList = ref([]);
const loading = ref(true);
const searchQuery = ref("");
const filterOfficer = ref("all");
const selectedIds = ref(new Set());

// 👇 State สำหรับ Search ใน Dropdown
const officerSearchQuery = ref("");
const cameraSearchQuery = ref("");
const isOfficerDropdownOpen = ref(false);
const isCameraDropdownOpen = ref(false);

// State สำหรับฟอร์มเพิ่ม
const newAssignment = reactive({
  officerEmail: "",
  cameraID: "",
});

// State สำหรับฟอร์มแก้ไข
const editingAssignment = ref(null);

// State สำหรับ Validation
const formErrors = reactive({
  officerEmail: "",
  cameraID: "",
});

// --- Computed ---
const totalAssignments = computed(() => assignments.value.length);

const assignmentsByOfficer = computed(() => {
  const counts = {};
  assignments.value.forEach((a) => {
    counts[a.officerEmail] = (counts[a.officerEmail] || 0) + 1;
  });
  return counts;
});

const topOfficer = computed(() => {
  if (assignments.value.length === 0) return null;
  let max = 0;
  let topEmail = "";
  for (const [email, count] of Object.entries(assignmentsByOfficer.value)) {
    if (count > max) {
      max = count;
      topEmail = email;
    }
  }
  return { email: topEmail, count: max };
});

const availableCameras = computed(() => {
  const assignedCameraIDs = new Set(assignments.value.map((a) => a.cameraID));
  return cameras.value.filter((c) => !assignedCameraIDs.has(c.cameraID));
});

// 👇 Filtered Officers for Dropdown
const filteredOfficers = computed(() => {
  if (!officerSearchQuery.value) return officersList.value;
  const query = officerSearchQuery.value.toLowerCase();
  return officersList.value.filter(
    (officer) =>
      officer.name.toLowerCase().includes(query) ||
      officer.email.toLowerCase().includes(query)
  );
});

// 👇 Filtered Cameras for Dropdown
const filteredCameras = computed(() => {
  if (!cameraSearchQuery.value) return availableCameras.value;
  const query = cameraSearchQuery.value.toLowerCase();
  return availableCameras.value.filter(
    (camera) =>
      camera.cameraID.toLowerCase().includes(query) ||
      camera.cameraName.toLowerCase().includes(query)
  );
});

const filteredAssignments = computed(() => {
  let result = assignments.value;

  if (filterOfficer.value !== "all") {
    result = result.filter((a) => a.officerEmail === filterOfficer.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((a) => {
      const camera = getCameraInfo(a.cameraID);
      return (
        a.cameraID.toLowerCase().includes(query) ||
        (camera && camera.cameraName.toLowerCase().includes(query))
      );
    });
  }

  return result;
});

const isAllSelected = computed(() => {
  return (
    filteredAssignments.value.length > 0 &&
    selectedIds.value.size === filteredAssignments.value.length
  );
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
  }
};

const getCameraInfo = (cameraID) => {
  return cameras.value.find((c) => c.cameraID === cameraID);
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

const fetchAssignments = async () => {
  assignments.value = [];
  try {
    const q = query(collection(db, "assignments"), orderBy("cameraID"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      assignments.value.push({ id: doc.id, ...doc.data() });
    });
  } catch (e) {
    console.error("Error fetching assignments: ", e);
    showAlert("เกิดข้อผิดพลาดในการดึงข้อมูล", { type: "error" });
  }
};

const validateForm = (data) => {
  formErrors.officerEmail = "";
  formErrors.cameraID = "";
  let isValid = true;

  if (!data.officerEmail) {
    formErrors.officerEmail = "กรุณาเลือกเจ้าหน้าที่";
    isValid = false;
  }

  if (!data.cameraID) {
    formErrors.cameraID = "กรุณาเลือกกล้อง";
    isValid = false;
  }

  return isValid;
};

const openAddModal = () => {
  newAssignment.officerEmail = "";
  newAssignment.cameraID = "";
  officerSearchQuery.value = "";
  cameraSearchQuery.value = "";
  isOfficerDropdownOpen.value = false;
  isCameraDropdownOpen.value = false;
  formErrors.officerEmail = "";
  formErrors.cameraID = "";
  document.getElementById("add_assignment_modal").showModal();
};

// 👇 Select Officer
const selectOfficer = (officer) => {
  newAssignment.officerEmail = officer.email;
  isOfficerDropdownOpen.value = false;
  officerSearchQuery.value = "";
};

// 👇 Select Camera
const selectCamera = (camera) => {
  newAssignment.cameraID = camera.cameraID;
  isCameraDropdownOpen.value = false;
  cameraSearchQuery.value = "";
};

// 👇 Get Selected Officer Info
const getSelectedOfficer = computed(() => {
  return officersList.value.find((o) => o.email === newAssignment.officerEmail);
});

// 👇 Get Selected Camera Info
const getSelectedCamera = computed(() => {
  return cameras.value.find((c) => c.cameraID === newAssignment.cameraID);
});

const handleAddAssignment = async () => {
  if (!validateForm(newAssignment)) {
    return;
  }

  const exists = assignments.value.some(
    (a) => a.cameraID === newAssignment.cameraID
  );
  if (exists) {
    formErrors.cameraID = "กล้องนี้ถูกมอบหมายแล้ว";
    return;
  }

  try {
    await addDoc(collection(db, "assignments"), {
      officerEmail: newAssignment.officerEmail,
      cameraID: newAssignment.cameraID,
    });

    document.getElementById("add_assignment_modal").close();
    await fetchAssignments();
    showToast("เพิ่ม Assignment สำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error adding document: ", e);
    showAlert("เกิดข้อผิดพลาดในการเพิ่มข้อมูล", { type: "error" });
  }
};

const handleDeleteAssignment = async (id, cameraID) => {
  const camera = getCameraInfo(cameraID);
  const cameraName = camera ? camera.cameraName : cameraID;

  const confirmed = await showConfirm({
    title: "ยืนยันการลบ",
    message: `คุณแน่ใจหรือไม่ว่าต้องการลบการมอบหมาย<br/><strong>"${cameraName}"</strong>?`,
    confirmText: "ลบ",
    cancelText: "ยกเลิก",
    type: "error",
  });

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "assignments", id));
    await fetchAssignments();
    showToast("ลบสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error deleting document: ", e);
    showAlert("เกิดข้อผิดพลาดในการลบข้อมูล", { type: "error" });
  }
};

const openEditModal = (assignment) => {
  editingAssignment.value = { ...assignment };
  formErrors.officerEmail = "";
  formErrors.cameraID = "";
  document.getElementById("edit_modal").showModal();
};

const handleUpdateAssignment = async () => {
  if (!editingAssignment.value) return;

  if (!validateForm(editingAssignment.value)) {
    return;
  }

  try {
    const docRef = doc(db, "assignments", editingAssignment.value.id);
    await updateDoc(docRef, {
      officerEmail: editingAssignment.value.officerEmail,
      cameraID: editingAssignment.value.cameraID,
    });
    document.getElementById("edit_modal").close();
    editingAssignment.value = null;
    await fetchAssignments();
    showToast("อัปเดตสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Error updating document: ", e);
    showAlert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล", { type: "error" });
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value.clear();
  } else {
    filteredAssignments.value.forEach((a) => {
      selectedIds.value.add(a.id);
    });
  }
};

const toggleSelect = (id) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
};

const handleBulkDelete = async () => {
  if (selectedIds.value.size === 0) {
    showAlert("กรุณาเลือกรายการที่ต้องการลบ", { type: "warning" });
    return;
  }

  const confirmed = await showConfirm({
    title: "ยืนยันการลบหลายรายการ",
    message: `คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>${selectedIds.value.size}</strong> รายการ?`,
    confirmText: "ลบทั้งหมด",
    cancelText: "ยกเลิก",
    type: "error",
  });

  if (!confirmed) return;

  try {
    const deletePromises = Array.from(selectedIds.value).map((id) =>
      deleteDoc(doc(db, "assignments", id))
    );
    await Promise.all(deletePromises);
    selectedIds.value.clear();
    await fetchAssignments();
    showToast(`ลบ ${deletePromises.length} รายการสำเร็จ ✅`, "success");
  } catch (e) {
    console.error("Error bulk deleting: ", e);
    showAlert("เกิดข้อผิดพลาดในการลบข้อมูล", { type: "error" });
  }
};

const getOfficerName = (email) => {
  const officer = officersList.value.find((o) => o.email === email);
  return officer ? officer.name : email;
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

onMounted(async () => {
  loading.value = true;
  await Promise.all([fetchCameras(), fetchOfficers(), fetchAssignments()]);
  loading.value = false;
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
          จัดการ Assignment
        </h2>
        <p class="text-base-content/70">
          การมอบหมายกล้องให้เจ้าหน้าที่ ({{ totalAssignments }} รายการ)
        </p>
      </div>

      <div class="flex gap-2">
        <button
          @click="
            fetchCameras();
            fetchOfficers();
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
        <button
          @click="openAddModal"
          class="btn btn-primary gap-2"
          :disabled="officersList.length === 0 || availableCameras.length === 0"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          เพิ่ม Assignment
        </button>
      </div>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="stats shadow bg-base-100">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div class="stat-title">มอบหมายแล้ว</div>
          <div class="stat-value text-primary">{{ totalAssignments }}</div>
          <div class="stat-desc">จากทั้งหมด {{ cameras.length }} กล้อง</div>
        </div>
      </div>

      <div class="stats shadow bg-base-100">
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
          <div class="stat-value text-warning">
            {{ availableCameras.length }}
          </div>
          <div class="stat-desc">กล้องที่รอมอบหมาย</div>
        </div>
      </div>

      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-accent">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div class="stat-title">มากที่สุด</div>
          <div class="stat-value text-accent">
            {{ topOfficer ? topOfficer.count : 0 }}
          </div>
          <div class="stat-desc">
            {{ topOfficer ? getOfficerName(topOfficer.email) : "-" }}
          </div>
        </div>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="card bg-base-100 shadow-md mb-6">
      <div class="card-body p-4">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="form-control flex-1">
            <div class="input-group">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="ค้นหา Camera UID หรือชื่อกล้อง..."
                class="input input-bordered flex-1 w-full"
              />
            </div>
          </div>

          <div class="form-control">
            <select
              v-model="filterOfficer"
              class="select select-bordered min-w-[200px] w-full"
            >
              <option value="all">ทุกคน ({{ assignments.length }})</option>
              <option
                v-for="officer in officersList"
                :key="officer.email"
                :value="officer.email"
              >
                {{ officer.name }} ({{
                  assignmentsByOfficer[officer.email] || 0
                }})
              </option>
            </select>
          </div>

          <div v-if="selectedIds.size > 0" class="flex gap-2">
            <button
              @click="handleBulkDelete"
              class="btn btn-error btn-sm gap-2"
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
              ลบ {{ selectedIds.size }} รายการ
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Table (Desktop) -->
    <div
      v-if="!loading && filteredAssignments.length > 0"
      class="hidden lg:block"
    >
      <div class="card bg-base-100 shadow-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead class="bg-base-200">
              <tr>
                <th class="w-12">
                  <label>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="isAllSelected"
                      @change="toggleSelectAll"
                    />
                  </label>
                </th>
                <th>Camera UID</th>
                <th>ชื่อกล้อง / จุดติดตั้ง</th>
                <th>เจ้าหน้าที่รับผิดชอบ</th>
                <th class="text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredAssignments"
                :key="item.id"
                class="hover"
                :class="{ 'bg-base-200': selectedIds.has(item.id) }"
              >
                <td>
                  <label>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="selectedIds.has(item.id)"
                      @change="toggleSelect(item.id)"
                    />
                  </label>
                </td>
                <td>
                  <button
                    @click="
                      copyToClipboard(
                        item.cameraID,
                        `คัดลอก ${item.cameraID} แล้ว ✅`
                      )
                    "
                    class="btn btn-soft btn-primary btn-sm hover:badge-primary transition-colors cursor-pointer"
                    title="คลิกเพื่อคัดลอก"
                  >
                    {{ item.cameraID }}
                  </button>
                </td>
                <td>
                  <div class="flex items-center gap-3">
                    <div>
                      <div class="font-bold">
                        {{
                          getCameraInfo(item.cameraID)?.cameraName ||
                          item.cameraID
                        }}
                      </div>
                      <div
                        v-if="getCameraInfo(item.cameraID)?.latitude"
                        class="text-xs text-base-content/70"
                      >
                        📍
                        {{ getCameraInfo(item.cameraID).latitude.toFixed(4) }},
                        {{ getCameraInfo(item.cameraID).longitude.toFixed(4) }}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="flex items-center gap-2">
                    <span class="text-sm">{{
                      getOfficerName(item.officerEmail)
                    }}</span>
                  </div>
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-2">
                    <button
                      @click="openEditModal(item)"
                      class="btn btn-warning btn-xs gap-1"
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
                      @click="handleDeleteAssignment(item.id, item.cameraID)"
                      class="btn btn-error btn-xs gap-1"
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

    <!-- Cards (Mobile) -->
    <div
      v-if="!loading && filteredAssignments.length > 0"
      class="lg:hidden space-y-4"
    >
      <div
        v-for="item in filteredAssignments"
        :key="item.id"
        class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow"
        :class="{ 'ring-2 ring-primary': selectedIds.has(item.id) }"
      >
        <div class="card-body p-4">
          <div class="flex justify-between items-start mb-3">
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                :checked="selectedIds.has(item.id)"
                @change="toggleSelect(item.id)"
              />
              <button
                @click="
                  copyToClipboard(
                    item.cameraID,
                    `คัดลอก ${item.cameraID} แล้ว ✅`
                  )
                "
                class="btn btn-soft btn-primary hover:badge-secondary transition-colors cursor-pointer"
                title="คลิกเพื่อคัดลอก"
              >
                {{ item.cameraID }}
              </button>
            </label>
          </div>

          <div class="flex items-start gap-3 mb-3">
            <div class="avatar placeholder">
              <div class="bg-primary text-primary-content rounded-full w-12">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
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
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-base mb-1">
                {{ getCameraInfo(item.cameraID)?.cameraName || item.cameraID }}
              </div>
              <div
                v-if="getCameraInfo(item.cameraID)?.latitude"
                class="text-xs text-base-content/70 flex items-center gap-1"
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

                {{ getCameraInfo(item.cameraID).latitude.toFixed(4) }},
                {{ getCameraInfo(item.cameraID).longitude.toFixed(4) }}
              </div>
            </div>
          </div>

          <div class="divider my-2"></div>

          <div class="mb-3">
            <div class="text-xs font-semibold text-base-content/70 mb-2">
              เจ้าหน้าที่รับผิดชอบ
            </div>
            <div class="flex items-center gap-2">
              <div class="avatar placeholder">
                <div class="bg-neutral text-neutral-content rounded-full w-10">
                  <span class="text-sm">{{
                    getOfficerName(item.officerEmail)[0]
                  }}</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">
                  {{ getOfficerName(item.officerEmail) }}
                </div>
                <div class="text-xs text-base-content/70 truncate">
                  {{ item.officerEmail }}
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              @click="openEditModal(item)"
              class="btn btn-warning btn-sm gap-2 flex-1"
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
              @click="handleDeleteAssignment(item.id, item.cameraID)"
              class="btn btn-error btn-sm gap-2 flex-1"
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
      v-else-if="!loading && filteredAssignments.length === 0"
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 class="text-xl font-bold mb-2">ไม่พบข้อมูล Assignment</h3>
      <p class="text-base-content/70 mb-4">
        {{
          searchQuery
            ? "ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา"
            : "ยังไม่มีการมอบหมายกล้องในระบบ"
        }}
      </p>
      <div
        v-if="!searchQuery && cameras.length === 0"
        class="alert alert-warning max-w-md mx-auto"
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
        <span>กรุณาเพิ่มกล้องก่อนสร้าง Assignment</span>
      </div>
      <div
        v-else-if="!searchQuery && officersList.length === 0"
        class="alert alert-warning max-w-md mx-auto"
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
        <span>กรุณาเพิ่มเจ้าหน้าที่ก่อนสร้าง Assignment</span>
      </div>
      <button
        v-else-if="
          !searchQuery && availableCameras.length > 0 && officersList.length > 0
        "
        @click="openAddModal"
        class="btn btn-primary"
      >
        เพิ่ม Assignment แรก
      </button>
    </div>

    <!-- Modal: Add Assignment -->
    <dialog id="add_assignment_modal" class="modal">
      <div class="modal-box max-w-2xl">
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
            <h3 class="font-bold text-2xl">เพิ่ม Assignment ใหม่</h3>
            <p class="text-sm text-base-content/60">
              มอบหมายกล้องให้เจ้าหน้าที่รับผิดชอบ
            </p>
          </div>
        </div>

        <form @submit.prevent="handleAddAssignment" class="space-y-6">
          <!-- ข้อมูล Assignment -->
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <h4 class="font-semibold text-lg">ข้อมูลการมอบหมาย</h4>
            </div>

            <!-- 👇 Custom Officer Dropdown with Search -->
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">
                  เจ้าหน้าที่รับผิดชอบ <span class="text-error">*</span>
                </span>
              </div>

              <!-- Selected Value Display -->
              <div
                @click="isOfficerDropdownOpen = !isOfficerDropdownOpen"
                class="input input-bordered w-full flex items-center justify-between cursor-pointer"
                :class="{
                  'input-error': formErrors.officerEmail,
                  'input-primary': isOfficerDropdownOpen,
                }"
              >
                <span v-if="getSelectedOfficer" class="flex items-center gap-2">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {{ getSelectedOfficer.name }} ({{ getSelectedOfficer.email }})
                </span>
                <span v-else class="text-base-content/50"
                  >เลือกเจ้าหน้าที่...</span
                >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 transition-transform"
                  :class="{ 'rotate-180': isOfficerDropdownOpen }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              <!-- Dropdown Menu -->
              <div
                v-show="isOfficerDropdownOpen"
                class="card bg-base-100 shadow-lg mt-2 p-2 w-full max-h-80 overflow-y-auto border border-base-300"
              >
                <!-- Search Box -->
                <div class="sticky top-0 bg-base-100 z-10 pb-2">
                  <input
                    v-model="officerSearchQuery"
                    type="text"
                    placeholder="🔍 ค้นหาชื่อหรืออีเมล..."
                    class="input input-bordered input-sm w-full"
                    @click.stop
                  />
                </div>

                <!-- Officer List -->
                <ul class="menu p-0">
                  <li
                    v-for="officer in filteredOfficers"
                    :key="officer.email"
                    @click="selectOfficer(officer)"
                    class="hover:bg-primary hover:text-primary-content py-2 px-3 rounded-lg cursor-pointer transition-colors"
                    :class="{
                      'bg-primary/20':
                        newAssignment.officerEmail === officer.email,
                    }"
                  >
                    <div class="flex items-center justify-between gap-3 w-full">
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm truncate">
                          {{ officer.name }}
                        </div>
                        <div class="text-xs opacity-70 truncate">
                          {{ officer.email }}
                        </div>
                      </div>
                      <svg
                        v-if="newAssignment.officerEmail === officer.email"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 text-primary shrink-0"
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
                    </div>
                  </li>
                  <li v-if="filteredOfficers.length === 0">
                    <div class="text-center text-base-content/50 py-4 text-sm">
                      ไม่พบเจ้าหน้าที่
                    </div>
                  </li>
                </ul>
              </div>

              <div class="label" v-if="formErrors.officerEmail">
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
                  {{ formErrors.officerEmail }}
                </span>
              </div>
            </label>

            <!-- 👇 Custom Camera Dropdown with Search -->
            <label class="form-control w-full">
              <div class="label mt-2">
                <span class="label-text font-medium">
                  เลือกกล้อง <span class="text-error">*</span>
                </span>
                <span class="label-text-alt"
                  >{{ availableCameras.length }} กล้องว่าง</span
                >
              </div>

              <!-- Selected Value Display -->
              <div
                @click="isCameraDropdownOpen = !isCameraDropdownOpen"
                class="input input-bordered w-full flex items-center justify-between cursor-pointer"
                :class="{
                  'input-error': formErrors.cameraID,
                  'input-primary': isCameraDropdownOpen,
                }"
              >
                <span v-if="getSelectedCamera" class="flex items-center gap-2">
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {{ getSelectedCamera.cameraID }} -
                  {{ getSelectedCamera.cameraName }}
                </span>
                <span v-else class="text-base-content/50">เลือกกล้อง...</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 transition-transform"
                  :class="{ 'rotate-180': isCameraDropdownOpen }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              <!-- Dropdown Menu -->
              <div
                v-show="isCameraDropdownOpen"
                class="card bg-base-100 shadow-lg mt-2 p-2 w-full max-h-80 overflow-y-auto border border-base-300"
              >
                <!-- Search Box -->
                <div class="sticky top-0 bg-base-100 z-10 pb-2">
                  <input
                    v-model="cameraSearchQuery"
                    type="text"
                    placeholder="🔍 ค้นหา Camera UID หรือชื่อกล้อง..."
                    class="input input-bordered input-sm w-full"
                    @click.stop
                  />
                </div>

                <!-- Camera List -->
                <ul class="menu p-0">
                  <li
                    v-for="camera in filteredCameras"
                    :key="camera.cameraID"
                    @click="selectCamera(camera)"
                    class=" hover:bg-primary hover:text-primary-content py-2 px-3 rounded-lg cursor-pointer transition-colors"
                    :class="{
                      'bg-primary/20':
                        newAssignment.cameraID === camera.cameraID,
                    }"
                  >
                    <div class="flex items-center justify-between gap-3 w-full">
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm truncate">
                          {{ camera.cameraID }}
                        </div>
                        <div class="text-xs opacity-70 truncate">
                          {{ camera.cameraName }}
                        </div>
                      </div>
                      <svg
                        v-if="newAssignment.cameraID === camera.cameraID"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 text-primary shrink-0"
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
                    </div>
                  </li>
                  <li v-if="filteredCameras.length === 0">
                    <div class="text-center text-base-content/50 py-4 text-sm">
                      ไม่พบกล้อง
                    </div>
                  </li>
                </ul>
              </div>

              <div class="label" v-if="formErrors.cameraID">
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
                  {{ formErrors.cameraID }}
                </span>
              </div>
              <div class="label" v-else>
                <span class="label-text-alt"
                  >เฉพาะกล้องที่ยังไม่ถูกมอบหมาย</span
                >
              </div>
            </label>
          </div>

          <!-- Camera Preview -->
          <div v-if="newAssignment.cameraID" class="alert alert-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="stroke-current shrink-0 w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="text-sm">
              <div class="font-bold">
                {{ getCameraInfo(newAssignment.cameraID)?.cameraName }}
              </div>
              <div
                v-if="getCameraInfo(newAssignment.cameraID)?.latitude"
                class="text-xs opacity-80"
              >
                📍 พิกัด:
                {{ getCameraInfo(newAssignment.cameraID).latitude.toFixed(4) }},
                {{ getCameraInfo(newAssignment.cameraID).longitude.toFixed(4) }}
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4 border-t border-base-300">
            <button
              type="button"
              class="btn btn-ghost flex-1"
              onclick="add_assignment_modal.close()"
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
              เพิ่ม Assignment
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Modal: Edit Assignment -->
    <dialog id="edit_modal" class="modal">
      <div class="modal-box max-w-2xl">
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
            <h3 class="font-bold text-2xl">แก้ไข Assignment</h3>
            <p class="text-sm text-base-content/60">
              เปลี่ยนเจ้าหน้าที่รับผิดชอบกล้อง
            </p>
          </div>
        </div>

        <form
          v-if="editingAssignment"
          @submit.prevent="handleUpdateAssignment"
          class="space-y-6"
        >
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <h4 class="font-semibold text-lg">ข้อมูลการมอบหมาย</h4>
            </div>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">
                  เจ้าหน้าที่รับผิดชอบ <span class="text-error">*</span>
                </span>
              </div>
              <select
                v-model="editingAssignment.officerEmail"
                class="select select-bordered w-full"
                :class="{ 'select-error': formErrors.officerEmail }"
                required
              >
                <option
                  v-for="officer in officersList"
                  :key="officer.email"
                  :value="officer.email"
                >
                  👤 {{ officer.name }} ({{ officer.email }})
                </option>
              </select>
              <div class="label" v-if="formErrors.officerEmail">
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
                  {{ formErrors.officerEmail }}
                </span>
              </div>
            </label>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">กล้อง</span>
              </div>
              <div class="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  class="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <div class="font-bold">{{ editingAssignment.cameraID }}</div>
                  <div class="text-sm opacity-80">
                    {{ getCameraInfo(editingAssignment.cameraID)?.cameraName }}
                  </div>
                </div>
              </div>
              <div class="label">
                <span class="label-text-alt"
                  >ไม่สามารถเปลี่ยนกล้องได้ กรุณาลบแล้วสร้างใหม่</span
                >
              </div>
            </label>
          </div>

          <div class="flex gap-3 pt-4 border-t border-base-300">
            <button
              type="button"
              class="btn btn-ghost flex-1"
              onclick="edit_modal.close()"
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
  </div>
</template>

<style scoped>
.card {
  transition: all 0.2s ease-in-out;
}

input[type="checkbox"]:checked {
  animation: checkBounce 0.3s ease-in-out;
}

@keyframes checkBounce {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.table tbody tr:hover {
  background-color: hsl(var(--b2) / 0.5);
}
</style>
