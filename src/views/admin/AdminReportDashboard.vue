<script setup>
import { ref, computed, onMounted } from 'vue';
import { db } from '../../firebase.js';
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";

// --- State ---
const reports = ref([]);
const cameras = ref([]);
const officers = ref([]);
const assignments = ref([]);
const loading = ref(true);

// Filters
const searchQuery = ref('');
const filterStatus = ref('all'); // all, Normal, Issue
const filterOfficer = ref('all');
const filterCamera = ref('all');

// Date Range Filter (ใหม่!)
const startDate = ref('');
const endDate = ref('');

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(20);

// --- Computed ---

// สถิติภาพรวม
const stats = computed(() => {
  const total = filteredReports.value.length;
  const normal = filteredReports.value.filter(r => r.status === 'Normal').length;
  const issue = filteredReports.value.filter(r => r.status === 'Issue').length;
  
  return {
    total,
    normal,
    issue,
    normalPercent: total > 0 ? Math.round((normal / total) * 100) : 0,
    issuePercent: total > 0 ? Math.round((issue / total) * 100) : 0
  };
});

// กล้องที่มีปัญหาบ่อย (Top 5)
const topIssueCameras = computed(() => {
  const issueCount = {};
  
  filteredReports.value
    .filter(r => r.status === 'Issue')
    .forEach(r => {
      const camera = getCameraInfo(r.cameraId);
      const key = camera ? camera.cameraName : r.cameraId;
      issueCount[key] = (issueCount[key] || 0) + 1;
    });
  
  return Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
});

// กรองรายงาน
const filteredReports = computed(() => {
  let result = reports.value;

  // กรองตามวันที่
  if (startDate.value) {
    const start = new Date(startDate.value);
    start.setHours(0, 0, 0, 0);
    result = result.filter(r => r.timestamp.toDate() >= start);
  }

  if (endDate.value) {
    const end = new Date(endDate.value);
    end.setHours(23, 59, 59, 999);
    result = result.filter(r => r.timestamp.toDate() <= end);
  }

  // กรองตามสถานะ
  if (filterStatus.value !== 'all') {
    result = result.filter(r => r.status === filterStatus.value);
  }

  // กรองตามเจ้าหน้าที่
  if (filterOfficer.value !== 'all') {
    result = result.filter(r => r.officerEmail === filterOfficer.value);
  }

  // กรองตามกล้อง
  if (filterCamera.value !== 'all') {
    result = result.filter(r => r.cameraId === filterCamera.value);
  }

  // ค้นหา
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(r => {
      const camera = getCameraInfo(r.cameraId);
      const cameraName = camera ? camera.cameraName : r.cameraId;
      return (
        cameraName.toLowerCase().includes(query) ||
        r.cameraId.toLowerCase().includes(query) ||
        r.officerEmail.toLowerCase().includes(query) ||
        (r.notes && r.notes.toLowerCase().includes(query))
      );
    });
  }

  return result;
});

// Pagination
const totalPages = computed(() => Math.ceil(filteredReports.value.length / itemsPerPage.value));

const paginatedReports = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredReports.value.slice(start, end);
});

// รายการเจ้าหน้าที่สำหรับ Filter
const uniqueOfficers = computed(() => {
  const emails = [...new Set(reports.value.map(r => r.officerEmail))];
  return emails.map(email => ({
    email,
    name: getOfficerName(email)
  }));
});

// รายการกล้องสำหรับ Filter
const uniqueCameras = computed(() => {
  const cameraIds = [...new Set(reports.value.map(r => r.cameraId))];
  return cameraIds.map(id => {
    const camera = getCameraInfo(id);
    return {
      id,
      name: camera ? camera.cameraName : id
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'th'));
});

// --- Functions ---

const getCameraInfo = (cameraId) => {
  // ถ้าเป็น assignment ID (จาก reports_log เก่า)
  const assignment = assignments.value.find(a => a.id === cameraId);
  if (assignment) {
    const camera = cameras.value.find(c => c.cameraID === assignment.cameraID);
    return camera;
  }
  // ถ้าเป็น cameraID ตรงๆ
  return cameras.value.find(c => c.cameraID === cameraId);
};

const getOfficerName = (email) => {
  const officer = officers.value.find(o => o.email === email);
  return officer ? officer.name : email;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '...';
  const date = timestamp.toDate();
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return '...';
  const date = timestamp.toDate();
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// ดึงข้อมูลทั้งหมด
const fetchData = async () => {
  loading.value = true;
  try {
    // ดึงข้อมูลพร้อมกัน
    const [camerasSnap, officersSnap, assignmentsSnap, reportsSnap] = await Promise.all([
      getDocs(query(collection(db, "cameras"))),
      getDocs(query(collection(db, "officers"))),
      getDocs(query(collection(db, "assignments"))),
      getDocs(query(collection(db, "reports_log"), orderBy("timestamp", "desc")))
    ]);

    cameras.value = [];
    camerasSnap.forEach(doc => {
      cameras.value.push({ id: doc.id, ...doc.data() });
    });

    officers.value = [];
    officersSnap.forEach(doc => {
      officers.value.push(doc.data());
    });

    assignments.value = [];
    assignmentsSnap.forEach(doc => {
      assignments.value.push({ id: doc.id, ...doc.data() });
    });

    reports.value = [];
    reportsSnap.forEach(doc => {
      reports.value.push({ id: doc.id, ...doc.data() });
    });

  } catch (e) {
    console.error("Error fetching data: ", e);
    alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
  } finally {
    loading.value = false;
  }
};

// ตั้งค่าวันที่เริ่มต้น (7 วันย้อนหลัง)
const setDefaultDateRange = () => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  endDate.value = today.toISOString().split('T')[0];
  startDate.value = sevenDaysAgo.toISOString().split('T')[0];
};

// Quick Date Filters
const setToday = () => {
  const today = new Date();
  startDate.value = today.toISOString().split('T')[0];
  endDate.value = today.toISOString().split('T')[0];
  currentPage.value = 1;
};

const setYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  startDate.value = yesterday.toISOString().split('T')[0];
  endDate.value = yesterday.toISOString().split('T')[0];
  currentPage.value = 1;
};

const setThisWeek = () => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  startDate.value = weekAgo.toISOString().split('T')[0];
  endDate.value = today.toISOString().split('T')[0];
  currentPage.value = 1;
};

const setThisMonth = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  startDate.value = firstDay.toISOString().split('T')[0];
  endDate.value = today.toISOString().split('T')[0];
  currentPage.value = 1;
};

const clearDateFilter = () => {
  startDate.value = '';
  endDate.value = '';
  currentPage.value = 1;
};

// Reset Filters
const resetFilters = () => {
  searchQuery.value = '';
  filterStatus.value = 'all';
  filterOfficer.value = 'all';
  filterCamera.value = 'all';
  clearDateFilter();
  currentPage.value = 1;
};

// Export to Excel
const exportToExcel = () => {
  if (filteredReports.value.length === 0) {
    alert('ไม่มีข้อมูลให้ Export');
    return;
  }

  // สร้าง CSV (ลบ email ออก)
  const headers = ['วันที่', 'เวลา', 'ชื่อกล้อง', 'Camera UID', 'สถานะ', 'หมายเหตุ', 'เจ้าหน้าที่'];
  
  const rows = filteredReports.value.map(report => {
    const camera = getCameraInfo(report.cameraId);
    const cameraName = camera ? camera.cameraName : report.cameraId;
    const cameraUID = camera ? camera.cameraID : report.cameraId;
    const date = report.timestamp.toDate();
    
    // ลบ newline และ quote ออกจาก notes
    const cleanNotes = (report.notes || '-').replace(/[\r\n]+/g, ' ').trim();
    
    return [
      date.toLocaleDateString('th-TH'),
      date.toLocaleTimeString('th-TH'),
      cameraName,
      cameraUID,
      report.status === 'Normal' ? 'ปกติ' : 'มีปัญหา',
      cleanNotes,
      getOfficerName(report.officerEmail)
    ];
  });

  // สร้าง CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // เพิ่ม BOM สำหรับ UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Download
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const filename = `CCTV_Report_${new Date().toISOString().split('T')[0]}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast(`ดาวน์โหลด ${filename} สำเร็จ`, 'success');
};

// Toast
const showToast = (message, type = 'success') => {
  const alertClass = type === 'success' ? 'alert-success' : 'alert-info';
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

// Pagination
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
    // Scroll ไปที่ตาราง แทนที่จะเป็นบนสุด
    const tableElement = document.querySelector('.table');
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

// --- Lifecycle ---
onMounted(async () => {
  setDefaultDateRange();
  await fetchData();
});
</script>

<template>
  <div class="py-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">รายงาน Log การตรวจสอบ</h2>
        <p class="text-base-content/70">
          ประวัติการรายงานสถานภาพกล้องทั้งหมด
        </p>
      </div>

      <div class="flex gap-2">
        <button @click="fetchData" class="btn btn-ghost gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          รีเฟรช
        </button>
        <button 
          @click="exportToExcel" 
          class="btn btn-success gap-2"
          :disabled="filteredReports.length === 0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export Excel
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else>
      <!-- Statistics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="stat-title">รายงานทั้งหมด</div>
            <div class="stat-value text-primary">{{ stats.total }}</div>
            <div class="stat-desc">รายการ</div>
          </div>
        </div>

        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-success">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="stat-title">สถานะปกติ</div>
            <div class="stat-value text-success">{{ stats.normal }}</div>
            <div class="stat-desc">{{ stats.normalPercent }}% ของทั้งหมด</div>
          </div>
        </div>

        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-warning">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="stat-title">พบปัญหา</div>
            <div class="stat-value text-warning">{{ stats.issue }}</div>
            <div class="stat-desc">{{ stats.issuePercent }}% ของทั้งหมด</div>
          </div>
        </div>

        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-error">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="stat-title">กล้องมีปัญหาบ่อย</div>
            <div class="stat-value text-error text-lg">
              {{ topIssueCameras.length > 0 ? topIssueCameras[0].name.substring(0, 15) + '...' : '-' }}
            </div>
            <div class="stat-desc">
              {{ topIssueCameras.length > 0 ? topIssueCameras[0].count + ' ครั้ง' : 'ไม่มีข้อมูล' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Pie Chart (Status) -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-lg mb-4">สัดส่วนสถานะ</h3>
            <div class="flex items-center justify-center h-64">
              <div class="radial-progress text-success" :style="`--value:${stats.normalPercent}; --size:12rem; --thickness:2rem;`" role="progressbar">
                <div class="text-center">
                  <div class="text-3xl font-bold">{{ stats.normalPercent }}%</div>
                  <div class="text-sm">ปกติ</div>
                </div>
              </div>
              <div class="ml-8 space-y-3">
                <div class="flex items-center gap-3">
                  <div class="w-4 h-4 bg-success rounded"></div>
                  <div>
                    <div class="font-bold">ปกติ: {{ stats.normal }}</div>
                    <div class="text-xs text-base-content/70">{{ stats.normalPercent }}%</div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="w-4 h-4 bg-warning rounded"></div>
                  <div>
                    <div class="font-bold">มีปัญหา: {{ stats.issue }}</div>
                    <div class="text-xs text-base-content/70">{{ stats.issuePercent }}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Issue Cameras -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-lg mb-4">กล้องที่มีปัญหาบ่อย (Top 5)</h3>
            <div v-if="topIssueCameras.length > 0" class="space-y-3">
              <div 
                v-for="(camera, index) in topIssueCameras" 
                :key="index"
                class="flex items-center gap-3"
              >
                <div class="badge badge-error">{{ index + 1 }}</div>
                <div class="flex-1">
                  <div class="font-semibold text-sm">{{ camera.name }}</div>
                  <progress 
                    class="progress progress-error w-full" 
                    :value="camera.count" 
                    :max="topIssueCameras[0].count"
                  ></progress>
                </div>
                <div class="badge badge-outline">{{ camera.count }} ครั้ง</div>
              </div>
            </div>
            <div v-else class="text-center py-10 text-base-content/50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>ไม่พบรายงานปัญหา 🎉</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Date Range Filter (ใหม่!) -->
      <div class="card bg-base-100 shadow-md mb-6">
        <div class="card-body p-4">
          <div class="flex flex-col gap-4">
            <!-- Quick Date Buttons -->
            <div>
              <label class="label">
                <span class="label-text font-semibold">เลือกช่วงเวลา</span>
              </label>
              <div class="flex flex-wrap gap-2">
                <button @click="setToday" class="btn btn-sm btn-outline">วันนี้</button>
                <button @click="setYesterday" class="btn btn-sm btn-outline">เมื่อวาน</button>
                <button @click="setThisWeek" class="btn btn-sm btn-outline">7 วัน</button>
                <button @click="setThisMonth" class="btn btn-sm btn-outline">เดือนนี้</button>
                <button @click="clearDateFilter" class="btn btn-sm btn-ghost">ทั้งหมด</button>
              </div>
            </div>

            <!-- Date Range Inputs -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">ตั้งแต่วันที่</span>
                </label>
                <input 
                  v-model="startDate" 
                  type="date" 
                  class="input input-bordered w-full"
                  @change="currentPage = 1"
                />
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">ถึงวันที่</span>
                </label>
                <input 
                  v-model="endDate" 
                  type="date" 
                  class="input input-bordered w-full"
                  @change="currentPage = 1"
                />
              </div>
            </div>

            <!-- Search Input -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">ค้นหา</span>
              </label>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="ค้นหาชื่อกล้อง, UID, หมายเหตุ..."
                class="input input-bordered w-full"
                @input="currentPage = 1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card bg-base-100 shadow-md mb-6">
        <div class="card-body p-4">
          <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center">
              <label class="label p-0">
                <span class="label-text font-semibold">ตัวกรอง</span>
              </label>
              <!-- Reset Button (แสดงเฉพาะมือถือ) -->
              <button @click="resetFilters" class="btn btn-ghost btn-sm gap-2 lg:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                รีเซ็ต
              </button>
            </div>

            <!-- Status Filter -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">สถานะ</span>
              </label>
              <select v-model="filterStatus" class="select select-bordered w-full" @change="currentPage = 1">
                <option value="all">ทั้งหมด ({{ reports.length }})</option>
                <option value="Normal">✅ ปกติ ({{ stats.normal }})</option>
                <option value="Issue">⚠️ มีปัญหา ({{ stats.issue }})</option>
              </select>
            </div>

            <!-- Officer Filter -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">เจ้าหน้าที่</span>
              </label>
              <select v-model="filterOfficer" class="select select-bordered w-full" @change="currentPage = 1">
                <option value="all">ทุกคน</option>
                <option 
                  v-for="officer in uniqueOfficers" 
                  :key="officer.email" 
                  :value="officer.email"
                >
                  {{ officer.name }}
                </option>
              </select>
            </div>

            <!-- Camera Filter -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">กล้อง</span>
              </label>
              <select v-model="filterCamera" class="select select-bordered w-full" @change="currentPage = 1">
                <option value="all">ทั้งหมด</option>
                <option 
                  v-for="camera in uniqueCameras" 
                  :key="camera.id" 
                  :value="camera.id"
                >
                  {{ camera.name }}
                </option>
              </select>
            </div>

            <!-- Reset Button (แสดงเฉพาะ Desktop) -->
            <button @click="resetFilters" class="btn btn-ghost gap-2 hidden lg:flex">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              รีเซ็ตตัวกรอง
            </button>
          </div>
        </div>
      </div>

      <!-- Results Summary -->
      <div class="mb-4 flex justify-between items-center">
        <p class="text-sm text-base-content/70">
          แสดง {{ paginatedReports.length }} จาก {{ filteredReports.length }} รายการ
          <span v-if="startDate || endDate" class="ml-2">
            ({{ startDate ? formatDate({ toDate: () => new Date(startDate) }) : 'ไม่ระบุ' }} - 
            {{ endDate ? formatDate({ toDate: () => new Date(endDate) }) : 'ไม่ระบุ' }})
          </span>
        </p>
        <div class="form-control">
          <select v-model="itemsPerPage" class="select select-bordered select-sm" @change="currentPage = 1">
            <option :value="10">10 / หน้า</option>
            <option :value="20">20 / หน้า</option>
            <option :value="50">50 / หน้า</option>
            <option :value="100">100 / หน้า</option>
          </select>
        </div>
      </div>

      <!-- Table (Desktop) -->
      <div v-if="filteredReports.length > 0" class="hidden lg:block">
        <div class="card bg-base-100 shadow-lg overflow-hidden mb-6">
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead class="bg-base-200">
                <tr>
                  <th class="w-20">#</th>
                  <th>วัน-เวลา</th>
                  <th>ชื่อกล้อง</th>
                  <th>สถานะ</th>
                  <th>หมายเหตุ</th>
                  <th>ผู้รายงาน</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in paginatedReports" :key="item.id" class="hover">
                  <td>{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm">{{ formatTimestamp(item.timestamp) }}</div>
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="avatar placeholder">
                        <div class="bg-primary text-primary-content rounded-full w-8">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <div class="font-medium">{{ getCameraInfo(item.cameraId)?.cameraName || item.cameraId }}</div>
                        <div class="text-xs text-base-content/70">{{ getCameraInfo(item.cameraId)?.cameraID || item.cameraId }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span v-if="item.status === 'Normal'" class="badge badge-success badge-lg gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      ปกติ
                    </span>
                    <span v-else class="badge badge-warning badge-lg gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      มีปัญหา
                    </span>
                  </td>
                  <td>
                    <span class="text-sm">{{ item.notes || '-' }}</span>
                  </td>
                  <td>
                    <div class="text-sm">
                      <div class="font-medium">{{ getOfficerName(item.officerEmail) }}</div>
                      <div class="text-xs text-base-content/70">{{ item.officerEmail }}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Cards (Mobile) -->
      <div v-if="filteredReports.length > 0" class="lg:hidden space-y-4 mb-6">
        <div 
          v-for="(item, index) in paginatedReports" 
          :key="item.id"
          class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow"
        >
          <div class="card-body p-4">
            <!-- Header: วัน-เวลา และ สถานะ -->
            <div class="flex justify-between items-start mb-3">
              <div class="text-sm text-base-content/70">
                {{ formatTimestamp(item.timestamp) }}
              </div>
              <span v-if="item.status === 'Normal'" class="badge badge-success gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                ปกติ
              </span>
              <span v-else class="badge badge-warning gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                มีปัญหา
              </span>
            </div>

            <!-- กล้อง -->
            <div class="flex items-start gap-3 mb-3">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-10">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-base truncate">
                  {{ getCameraInfo(item.cameraId)?.cameraName || item.cameraId }}
                </div>
                <div class="text-xs text-base-content/70 truncate">
                  {{ getCameraInfo(item.cameraId)?.cameraID || item.cameraId }}
                </div>
              </div>
            </div>

            <!-- หมายเหตุ (ถ้ามี) -->
            <div v-if="item.notes" class="mb-3">
              <div class="text-xs font-semibold text-base-content/70 mb-1">หมายเหตุ:</div>
              <div class="text-sm bg-base-200 rounded-lg p-2">
                {{ item.notes }}
              </div>
            </div>

            <!-- Divider -->
            <div class="divider my-2"></div>

            <!-- ผู้รายงาน -->
            <div class="flex items-center gap-2">
              <div class="avatar placeholder">
                <div class="bg-neutral text-neutral-content rounded-full w-8">
                  <span class="text-xs">{{ getOfficerName(item.officerEmail).charAt(0) }}</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ getOfficerName(item.officerEmail) }}</div>
                <div class="text-xs text-base-content/70 truncate">{{ item.officerEmail }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center">
        <div class="join">
          <button 
            class="join-item btn btn-sm"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
          >
            «
          </button>
          
          <button 
            v-for="page in Math.min(totalPages, 10)" 
            :key="page"
            class="join-item btn btn-sm"
            :class="{ 'btn-active': page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          
          <button 
            class="join-item btn btn-sm"
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
          >
            »
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredReports.length === 0" class="text-center py-20">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-xl font-bold mb-2">ไม่พบข้อมูลรายงาน</h3>
        <p class="text-base-content/70">
          {{ searchQuery || filterStatus !== 'all' ? 'ลองปรับเงื่อนไขการค้นหา' : 'ยังไม่มีรายงานในระบบ' }}
        </p>
        <button @click="resetFilters" class="btn btn-primary mt-4">รีเซ็ตตัวกรอง</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table {
  font-size: 0.875rem;
}

.radial-progress {
  font-family: inherit;
}
</style>