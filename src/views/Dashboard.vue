<script setup>
import { ref, reactive, onMounted, computed, watch } from "vue";
import { auth, db } from "../firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useDialog } from "../composables/useDialog.js";

const { showConfirm, showAlert, showToast } = useDialog();

// 👇 เพิ่มส่วนนี้
// เพิ่มตัวเลือกประเภทกล้อง
const cameraTypes = [
  { value: "4G", label: "4G", icon: "📡", color: "badge-primary" },
  { value: "WIFI", label: "WIFI", icon: "📶", color: "badge-info" },
  { value: "Tactical", label: "Tactical", icon: "🎯", color: "badge-warning" },
];

// ฟังก์ชันหาข้อมูล Camera Type
const getCameraTypeInfo = (type) => {
  return cameraTypes.find((t) => t.value === type) || cameraTypes[0];
};
// --- State Variables ---
const tasks = ref([]);
const cameras = ref([]);
const loading = ref(true);
const submittingReport = ref(false);
const userName = ref("กำลังโหลด...");
const userEmail = ref(auth.currentUser?.email);
const searchQuery = ref("");
const filterStatus = ref("all"); // all, reported, pending

// --- Computed Properties ---
const totalCameras = computed(() => tasks.value.length);
const reportedCount = computed(
  () => tasks.value.filter((t) => t.reportedToday).length
);
const pendingCount = computed(
  () => tasks.value.filter((t) => !t.reportedToday).length
);
// ✅ ใหม่ - นับจาก tasks.value (ถูกต้อง)
const camera4GCount = computed(
  () => tasks.value.filter((t) => (t.cameraType || "4G") === "4G").length
);
const cameraWIFICount = computed(
  () => tasks.value.filter((t) => t.cameraType === "WIFI").length
);
const cameraTacticalCount = computed(
  () => tasks.value.filter((t) => t.cameraType === "Tactical").length
);
// กรองกล้องตามคำค้นหาและสถานะ
const filteredTasks = computed(() => {
  let result = tasks.value;

  // กรองตามคำค้นหา
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (task) =>
        task.cameraName.toLowerCase().includes(query) ||
        task.cameraID?.toLowerCase().includes(query)
    );
  }

  // กรองตามสถานะ
  if (filterStatus.value === "reported") {
    result = result.filter((task) => task.reportedToday);
  } else if (filterStatus.value === "pending") {
    result = result.filter((task) => !task.reportedToday);
  }

  return result;
});
const showEditModal = ref(false);
const editFormData = reactive({
  task: null,
  status: "Normal",
  notes: "",
});
// --- Functions ---

// หาข้อมูลกล้องจาก cameraID
const getCameraInfo = (cameraID) => {
  return cameras.value.find((c) => c.cameraID === cameraID);
};

const fetchTasks = async () => {
  loading.value = true;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- 1. ดึงชื่อเจ้าหน้าที่จาก officers collection ---
    const officerQuery = query(
      collection(db, "officers"),
      where("email", "==", userEmail.value)
    );
    const officerSnapshot = await getDocs(officerQuery);
    if (!officerSnapshot.empty) {
      const officerData = officerSnapshot.docs[0].data();
      userName.value = officerData.name || "เจ้าหน้าที่";
    } else {
      userName.value = auth.currentUser?.displayName || "เจ้าหน้าที่";
    }

    // --- 2. ดึงรายการกล้องทั้งหมด ---
    const camerasQuery = query(collection(db, "cameras"));
    const camerasSnapshot = await getDocs(camerasQuery);
    cameras.value = [];
    camerasSnapshot.forEach((doc) => {
      cameras.value.push({ id: doc.id, ...doc.data() });
    });

    // --- 3. ดึง Assignments ของเรา ---
    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("officerEmail", "==", userEmail.value)
    );

    // --- 4. ดึงรายงานวันนี้ ---
    const reportsQuery = query(
      collection(db, "reports_log"),
      where("officerEmail", "==", userEmail.value),
      where("timestamp", ">=", today)
    );

    const [assignmentsSnapshot, reportsSnapshot] = await Promise.all([
      getDocs(assignmentsQuery),
      getDocs(reportsQuery),
    ]);

    // --- 5. สร้าง Map ของงานที่รายงานแล้ว (เก็บข้อมูลรายงานด้วย) ---
    const reportedData = new Map();
    reportsSnapshot.forEach((doc) => {
      const reportData = doc.data();
      reportedData.set(doc.data().cameraId, {
        reportId: doc.id,
        status: reportData.status,
        notes: reportData.notes || "",
        timestamp: reportData.timestamp,
      });
    });

    // --- 6. ประมวลผลงาน ---
    const fetchedTasks = [];
    assignmentsSnapshot.forEach((doc) => {
      const assignment = doc.data();
      const cameraInfo = getCameraInfo(assignment.cameraID);
      const reportInfo = reportedData.get(doc.id);

      // ถ้าหากล้องใน cameras collection
      if (cameraInfo) {
        fetchedTasks.push({
          id: doc.id,
          cameraID: cameraInfo.cameraID,
          cameraName: cameraInfo.cameraName,
          cameraType: cameraInfo.cameraType || '4G', // 👈 ต้องมีบรรทัดนี้
          latitude: cameraInfo.latitude,
          longitude: cameraInfo.longitude,
          photoURL: cameraInfo.photoURL,
          reportedToday: reportedData.has(doc.id),
          reportData: reportInfo || null, // เก็บข้อมูลรายงาน
        });
      } else {
        // ถ้าไม่เจอ (กรณีข้อมูลไม่ตรงกัน)
        fetchedTasks.push({
          id: doc.id,
          cameraID: assignment.cameraID,
          cameraName: assignment.cameraID, // ใช้ ID แทน
          cameraType: '4G', // 👈 ต้องมีบรรทัดนี้
          latitude: null,
          longitude: null,
          photoURL: null,
          reportedToday: reportedData.has(doc.id),
          reportData: reportInfo || null,
        });
      }
    });

    tasks.value = fetchedTasks;
  } catch (e) {
    console.error("Failed to fetch tasks:", e);
    showAlert("เกิดข้อผิดพลาดในการโหลดข้อมูล", { type: "error" });
  } finally {
    loading.value = false;
  }
};
// 👈 เพิ่มฟังก์ชันนี้ (วางไว้หลังฟังก์ชัน handleReport)
const showPromptDialog = (message, defaultValue = "") => {
  return new Promise((resolve) => {
    const modal = document.createElement("dialog");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">${message}</h3>
        <textarea 
          id="promptInput" 
          class="textarea textarea-bordered w-full" 
          placeholder="ระบุรายละเอียด..."
          rows="3"
        >${defaultValue}</textarea>
        <div class="modal-action">
          <button id="cancelPrompt" class="btn btn-ghost">ยกเลิก</button>
          <button id="confirmPrompt" class="btn btn-primary">ตกลง</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button"></button>
      </form>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    const input = modal.querySelector("#promptInput");
    const cancelBtn = modal.querySelector("#cancelPrompt");
    const confirmBtn = modal.querySelector("#confirmPrompt");

    // Focus input
    setTimeout(() => input.focus(), 100);

    cancelBtn.addEventListener("click", () => {
      modal.close();
      document.body.removeChild(modal);
      resolve(null);
    });

    confirmBtn.addEventListener("click", () => {
      const value = input.value.trim();
      if (!value) {
        showAlert("กรุณาระบุข้อมูล", { type: "warning" });
        return;
      }
      modal.close();
      document.body.removeChild(modal);
      resolve(value);
    });

    modal.addEventListener("close", () => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
        resolve(null);
      }
    });
  });
};

// ส่งรายงาน
const handleReport = async (taskId, status) => {
  submittingReport.value = true;
  try {
    let notes = "";

    if (status === "Issue") {
      const result = await showPromptDialog("กรุณาระบุปัญหา", "");
      if (!result) {
        submittingReport.value = false;
        return;
      }
      notes = result;
    }

    await addDoc(collection(db, "reports_log"), {
      cameraId: taskId,
      status: status,
      notes: notes || "",
      officerEmail: userEmail.value,
      timestamp: serverTimestamp(),
    });

    // อัปเดต UI
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.reportedToday = true;
      task.reportData = {
        status: status,
        notes: notes || "",
        timestamp: new Date(), // ใช้เวลาปัจจุบันชั่วคราว
      };
    }

    // แสดงข้อความสำเร็จ
    showToast(
      status === "Normal" ? "บันทึกสถานะปกติแล้ว ✅" : "บันทึกปัญหาแล้ว ⚠️",
      "success"
    );
  } catch (e) {
    console.error("Failed to submit report:", e);
    showAlert("เกิดข้อผิดพลาดในการส่งรายงาน", { type: "error" });
  } finally {
    submittingReport.value = false;
  }
};

// เปลี่ยนฟังก์ชัน handleEditReport
const handleEditReport = async (task) => {
  if (!task.reportData) return;

  // เปิด modal และเซ็ตค่าเริ่มต้น
  editFormData.task = task;
  editFormData.status = task.reportData.status;
  editFormData.notes = task.reportData.notes || "";
  showEditModal.value = true;
};

// 👇 เพิ่ม watch เพื่อเคลียร์หมายเหตุเมื่อเปลี่ยนเป็น Normal
watch(() => editFormData.status, (newStatus) => {
  if (newStatus === 'Normal') {
    editFormData.notes = '';
  }
});

// ฟังก์ชันบันทึกการแก้ไข
const confirmEditReport = async () => {
  if (!editFormData.status) {
    showAlert("กรุณาเลือกสถานะ", { type: "warning" });
    return;
  }

  if (editFormData.status === "Issue" && !editFormData.notes.trim()) {
    showAlert("กรุณาระบุปัญหา", { type: "warning" });
    return;
  }

  submittingReport.value = true;
  try {
    const task = editFormData.task;
    const reportRef = doc(db, "reports_log", task.reportData.reportId);
// 👇 เคลียร์หมายเหตุถ้าสถานะเป็น Normal
    const notesToSave = editFormData.status === 'Normal' ? '' : editFormData.notes.trim();

    await updateDoc(reportRef, {
      status: editFormData.status,
      notes: editFormData.notes.trim() || "",
      timestamp: serverTimestamp(),
    });

    // อัปเดต UI
    task.reportData.status = editFormData.status;
    task.reportData.notes = editFormData.notes.trim() || "";
    task.reportData.timestamp = new Date();

    showEditModal.value = false;
    showToast("แก้ไขรายงานสำเร็จ ✅", "success");
  } catch (e) {
    console.error("Failed to edit report:", e);
    showAlert("เกิดข้อผิดพลาดในการแก้ไขรายงาน", { type: "error" });
  } finally {
    submittingReport.value = false;
  }
};

// รายงานทั้งหมดปกติ
const handleBulkReportNormal = async () => {
  const pendingTasks = tasks.value.filter((t) => !t.reportedToday);

  if (pendingTasks.length === 0) {
    showToast("ไม่มีกล้องที่รอรายงาน", "info");
    return;
  }

  const confirmed = await showConfirm({
    title: "ยืนยันการรายงานทั้งหมด",
    message: `คุณแน่ใจหรือไม่ว่าต้องการรายงานกล้องทั้งหมด<br/><strong>${pendingTasks.length}</strong> ตัวเป็น <strong>"ปกติ"</strong>?`,
    confirmText: "รายงานทั้งหมด",
    cancelText: "ยกเลิก",
    type: "info",
  });

  if (!confirmed) return;

  submittingReport.value = true;

  try {
    // สร้าง reports ทั้งหมดพร้อมกัน
    const reportPromises = pendingTasks.map((task) =>
      addDoc(collection(db, "reports_log"), {
        cameraId: task.id,
        status: "Normal",
        notes: "",
        officerEmail: userEmail.value,
        timestamp: serverTimestamp(),
      })
    );

    await Promise.all(reportPromises);

    // อัปเดต UI
    pendingTasks.forEach((task) => {
      task.reportedToday = true;
      task.reportData = {
        status: "Normal",
        notes: "",
        timestamp: new Date(),
      };
    });

    showToast(
      `บันทึก ${pendingTasks.length} กล้องเป็นสถานะปกติแล้ว ✅`,
      "success"
    );
  } catch (e) {
    console.error("Failed to bulk report:", e);
    showAlert("เกิดข้อผิดพลาดในการส่งรายงาน", { type: "error" });
  } finally {
    submittingReport.value = false;
  }
};

// เปิด Modal แสดงรูปภาพ
const showImageModal = (photoURL) => {
  if (!photoURL) return;

  const modal = document.createElement("dialog");
  modal.className = "modal";
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
  modal.addEventListener("close", () => {
    modal.remove();
  });
};

// เปิดแผนที่
const openMap = (lat, lng) => {
  if (!lat || !lng) return;
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
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
      <p class="text-base-content/70">รายงานสถานภาพกล้องวงจรปิดประจำวัน</p>
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
                ></path>
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
                ></path>
              </svg>
            </div>
            <div class="stat-title">รายงานแล้ว</div>
            <div class="stat-value text-success">{{ reportedCount }}</div>
            <div class="stat-desc">
              {{
                totalCameras > 0
                  ? Math.round((reportedCount / totalCameras) * 100)
                  : 0
              }}% เสร็จสิ้น
            </div>
          </div>
        </div>

        <!-- Card 3: Pending -->
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
                ></path>
              </svg>
            </div>
            <div class="stat-title">รอดำเนินการ</div>
            <div class="stat-value text-warning">{{ pendingCount }}</div>
            <div class="stat-desc">ยังไม่ได้รายงาน</div>
          </div>
        </div>
        <!-- 👇 Card 4: 4G Cameras (ใหม่) -->
        <div class="stats shadow bg-base-100">
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
        </div>

        <!-- 👇 Card 5: WIFI Cameras (ใหม่) -->
        <div class="stats shadow bg-base-100">
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
        </div>

        <!-- 👇 Card 6: Tactical Cameras (ใหม่) -->
        <div class="stats shadow bg-base-100">
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
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="card bg-base-100 shadow-md mb-6">
        <div class="card-body p-4">
          <div class="flex flex-col md:flex-row gap-4">
            <!-- Search Input -->
            <div class="form-control flex-1">
              <div class="input-group">
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

            <!-- Bulk Report Button (แสดงเฉพาะเมื่อมีกล้องที่ยังไม่รายงาน) -->
            <button
              v-if="pendingCount > 0"
              @click="handleBulkReportNormal"
              class="btn btn-success gap-2"
              :disabled="submittingReport"
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              รายงานทั้งหมดปกติ ({{ pendingCount }})
            </button>

            <!-- Refresh Button -->
            <button @click="fetchTasks" class="btn btn-square btn-ghost">
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Camera Cards Grid -->
      <div
        v-if="filteredTasks.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300"
          :class="{
            'border-2 border-success':
              task.reportedToday && task.reportData?.status === 'Normal',
            'border-2 border-warning bg-warning/10':
              task.reportedToday && task.reportData?.status === 'Issue',
            'border-2 border-base-300': !task.reportedToday,
          }"
        >
          <!-- Camera Photo -->
          <figure
            v-if="task.photoURL"
            class="relative h-48 bg-base-200 cursor-pointer"
            @click="showImageModal(task.photoURL)"
          >
            <img
              :src="task.photoURL"
              :alt="task.cameraName"
              class="w-full h-full object-cover"
              @error="(e) => (e.target.style.display = 'none')"
            />
            <div class="absolute top-2 right-2">
              <button
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
            <!-- Camera Icon & Status Badge -->
            <div class="flex justify-between items-start mb-2">
              <!-- 👇 เปลี่ยนจาก Avatar เป็น Badge -->
              <div class="flex flex-col gap-2">
                <div
                  class="badge badge-lg gap-2"
                  :class="getCameraTypeInfo(task.cameraType || '4G').color"
                >
                  <span class="text-lg">{{
                    getCameraTypeInfo(task.cameraType || "4G").icon
                  }}</span>
                  <span class="font-semibold">{{
                    getCameraTypeInfo(task.cameraType || "4G").label
                  }}</span>
                </div>
              </div>

              <div v-if="task.reportedToday" class="flex flex-col gap-1">
                <!-- Status Badge -->
                <div
                  class="badge badge-lg gap-2"
                  :class="
                    task.reportData?.status === 'Normal'
                      ? 'badge-success'
                      : 'badge-warning'
                  "
                >
                  <svg
                    v-if="task.reportData?.status === 'Normal'"
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {{
                    task.reportData?.status === "Normal" ? "ปกติ" : "มีปัญหา"
                  }}
                </div>

                <!-- 👈 (ใหม่!) Edit Button -->
                <button
                  @click="handleEditReport(task)"
                  class="btn btn-xs btn-ghost gap-1 text-info hover:bg-info hover:text-info-content"
                  :disabled="submittingReport"
                  title="แก้ไขรายงาน"
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
              </div>

              <div v-else class="badge badge-warning badge-lg gap-2">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
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
              
              <button
                @click="
                  copyToClipboard(
                    task.cameraID,
                    `คัดลอก ${task.cameraID} แล้ว ✅`
                  )
                "
                class="btn btn-soft btn-primary btn-sm hover:badge-primary transition-colors cursor-pointer"
                title="คลิกเพื่อคัดลอก"
              >
                <span class="font-semibold">UID: </span>{{ task.cameraID }}
              </button>
            </p>

            <!-- 👈 (ใหม่!) แสดงหมายเหตุ (ถ้ามี) -->
            <div
              v-if="task.reportedToday && task.reportData?.notes"
              class="mt-2"
            >
              <p class="text-sm text-base-content/70">
                <span class="font-semibold">หมายเหตุ: </span>
                <span class="italic">{{ task.reportData.notes }}</span>
              </p>
            </div>

            <!-- Location -->
            <div
              v-if="task.latitude && task.longitude"
              class="flex items-center gap-2 text-sm mt-2"
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                มีปัญหา
              </button>
              <button
                @click="handleReport(task.id, 'Normal')"
                class="btn btn-success btn-sm gap-2"
                :disabled="submittingReport"
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                ปกติ
              </button>
            </div>

            <!-- Already Reported Message -->
            <div v-else class="alert alert-success shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span class="text-sm">รายงานสถานภาพแล้ววันนี้</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-20">
        <div class="max-w-md mx-auto">
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
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 class="text-xl font-bold mb-2">ไม่พบรายการกล้อง</h3>
          <p class="text-base-content/70">
            {{
              searchQuery
                ? "ไม่พบผลลัพธ์ที่ตรงกับคำค้นหา"
                : "ไม่พบรายการกล้องที่คุณรับผิดชอบในขณะนี้"
            }}
          </p>
        </div>
      </div>
    </div>
  </div>
  <!-- Modal สำหรับแก้ไข -->
  <dialog :open="showEditModal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">แก้ไขรายงานสถานะ</h3>

      <div class="space-y-4">
        <div>
          <label class="label">
            <span class="label-text font-semibold">สถานะ</span>
          </label>
          <div class="flex gap-4">
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                v-model="editFormData.status"
                value="Normal"
                class="radio radio-success"
              />
              <span>ปกติ</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                v-model="editFormData.status"
                value="Issue"
                class="radio radio-warning"
              />
              <span>มีปัญหา</span>
            </label>
          </div>
        </div>

        <!-- 👇 แสดงเฉพาะเมื่อสถานะเป็น Issue -->
        <div v-if="editFormData.status === 'Issue'">
          <label class="label">
            <span class="label-text font-semibold">หมายเหตุ <span class="text-error">*</span></span>
          </label>
          <textarea
            v-model="editFormData.notes"
            class="textarea textarea-bordered w-full"
            placeholder="ระบุปัญหา..."
            rows="3"
          ></textarea>
        </div>

        <!-- 👇 (ใหม่) แสดงข้อความเมื่อเปลี่ยนเป็น Normal -->
        <div v-else class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm">หมายเหตุจะถูกล้างเมื่อเปลี่ยนเป็นสถานะปกติ</span>
        </div>
      </div>

      <div class="modal-action">
        <button
          @click="showEditModal = false"
          class="btn btn-ghost"
          :disabled="submittingReport"
        >
          ยกเลิก
        </button>
        <button
          @click="confirmEditReport"
          class="btn btn-primary"
          :disabled="submittingReport"
        >
          <span
            v-if="submittingReport"
            class="loading loading-spinner loading-sm"
          ></span>
          <span v-else>บันทึก</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="showEditModal = false">
      <button>close</button>
    </form>
  </dialog>
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
