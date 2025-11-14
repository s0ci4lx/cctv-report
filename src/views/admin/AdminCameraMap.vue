<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from "vue";
import { db } from "../../firebase.js";
import { collection, getDocs, query } from "firebase/firestore";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// 👇 เพิ่มตัวเลือกประเภทกล้อง (สีตรงกับหมุด)
const cameraTypes = [
  { value: '4G', label: '4G', icon: '📡', color: 'badge-4g' },
  { value: 'WIFI', label: 'WIFI', icon: '📶', color: 'badge-wifi' },
  { value: 'Tactical', label: 'Tactical', icon: '🎯', color: 'badge-tactical' }
];

// ฟังก์ชันหาข้อมูล Camera Type
const getCameraTypeInfo = (type) => {
  return cameraTypes.find(t => t.value === type) || cameraTypes[0];
};

// --- State ---
const cameras = ref([]);
const assignments = ref([]);
const officers = ref([]);
const loading = ref(true);
const map = ref(null);
const markerClusterGroup = ref(null);

// Filters
const searchQuery = ref("");
const filterStatus = ref("all");

// Map config
const defaultCenter = [6.7894, 100.9469];
const defaultZoom = 13;

// --- Computed ---
const filteredCameras = computed(() => {
  let result = cameras.value.filter((c) => c.latitude && c.longitude);

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (c) =>
        c.cameraName.toLowerCase().includes(query) ||
        c.cameraID.toLowerCase().includes(query)
    );
  }

  if (filterStatus.value === "assigned") {
    result = result.filter((c) => isAssigned(c.cameraID));
  } else if (filterStatus.value === "unassigned") {
    result = result.filter((c) => !isAssigned(c.cameraID));
  }

  return result;
});

const stats = computed(() => {
  const total = cameras.value.filter((c) => c.latitude && c.longitude).length;
  const assigned = cameras.value.filter(
    (c) => c.latitude && c.longitude && isAssigned(c.cameraID)
  ).length;

  return {
    total,
    assigned,
    unassigned: total - assigned,
  };
});

// 👇 เพิ่ม computed สำหรับนับจำนวนกล้องแต่ละประเภท
const cameraTypeStats = computed(() => {
  const camerasWithCoords = cameras.value.filter((c) => c.latitude && c.longitude);
  
  return {
    camera4G: camerasWithCoords.filter(c => (c.cameraType || '4G') === '4G').length,
    cameraWIFI: camerasWithCoords.filter(c => c.cameraType === 'WIFI').length,
    cameraTactical: camerasWithCoords.filter(c => c.cameraType === 'Tactical').length,
  };
});

// --- Functions ---
const isAssigned = (cameraID) => {
  return assignments.value.some((a) => a.cameraID === cameraID);
};

const getAssignedOfficer = (cameraID) => {
  const assignment = assignments.value.find((a) => a.cameraID === cameraID);
  if (!assignment) return null;

  const officer = officers.value.find(
    (o) => o.email === assignment.officerEmail
  );
  return officer ? officer.name : assignment.officerEmail;
};

const fixLeafletIcon = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
};

// ✅ แก้ไข - สีตามประเภทกล้อง
const createIcon = (cameraType) => {
  // กำหนดสีตามประเภทกล้อง
  const colorMap = {
    '4G': '#ef4444',      // สีแดง (red-500)
    'WIFI': '#06b6d4',    // สีฟ้า (cyan-500)
    'Tactical': '#eab308' // สีเหลือง (yellow-500)
  };
  
  const color = colorMap[cameraType] || colorMap['4G'];
  
  const icon = L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; transform: rotate(45deg); fill: white;" viewBox="0 0 24 24">
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

  return icon;
};

const destroyMap = () => {
  if (markerClusterGroup.value) {
    markerClusterGroup.value.clearLayers();
    markerClusterGroup.value = null;
  }

  if (map.value) {
    map.value.remove();
    map.value = null;
  }
};

const initMap = () => {
  destroyMap();

  setTimeout(() => {
    const mapElement = document.getElementById("map");
    if (!mapElement) {
      console.error("Map element not found");
      return;
    }

    map.value = L.map("map").setView(defaultCenter, defaultZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.value);

    markerClusterGroup.value = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 60,
    });

    map.value.addLayer(markerClusterGroup.value);

    updateMarkers();

    setTimeout(() => {
      fitBounds();
    }, 300);
  }, 100);
};

// 👇 แก้ไข updateMarkers เพื่อเพิ่มข้อมูลประเภทกล้องใน popup
const updateMarkers = () => {
  if (!markerClusterGroup.value) return;

  markerClusterGroup.value.clearLayers();

  filteredCameras.value.forEach((camera) => {
    const assigned = isAssigned(camera.cameraID);
    const officer = getAssignedOfficer(camera.cameraID);
    const typeInfo = getCameraTypeInfo(camera.cameraType || '4G');

    // ✅ ใช้ประเภทกล้องสำหรับสีหมุด
    const marker = L.marker([camera.latitude, camera.longitude], {
      icon: createIcon(camera.cameraType || '4G'),
    });

    // Create popup content with camera type
    const popupContent = `
      <div class="p-3 min-w-[250px]">
        <div class="flex items-center gap-2 mb-3">
          <div class="badge ${assigned ? "badge-success" : "badge-warning"} gap-1">
            ${assigned ? "✓ มอบหมายแล้ว" : "⏳ ยังไม่มอบหมาย"}
          </div>
          <div class="badge ${typeInfo.color} gap-1">
            ${typeInfo.icon} ${typeInfo.label}
          </div>
        </div>
        
        <h2 class="font-bold text-lg mb-2">${camera.cameraName}</h2>
        <p class="text-sm text-gray-600 mb-2">
          <span class="font-semibold">UID:</span> ${camera.cameraID}
        </p>
        
        ${officer ? `
          <p class="text-sm text-gray-600 mb-2">
            <span class="font-semibold">เจ้าหน้าที่:</span> ${officer}
          </p>
        ` : ""}
        
        <p class="text-sm text-gray-600 mb-3">
          <span class="font-semibold">พิกัด:</span>
          ${camera.latitude.toFixed(6)}, ${camera.longitude.toFixed(6)}
        </p>
        
        ${camera.photoURL ? `
          <img src="${camera.photoURL}" 
               alt="${camera.cameraName}" 
               class="w-full h-32 object-cover rounded-lg mb-2"
               onerror="this.style.display='none'"/>
        ` : ""}
        
        <div class="flex gap-2 mt-3">
          <a href="https://www.google.com/maps?q=${camera.latitude},${camera.longitude}" 
             target="_blank"
             class="btn btn-primary btn-sm flex-1">
            📍 Google Maps
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 300 });
    markerClusterGroup.value.addLayer(marker);
  });
};

const fitBounds = () => {
  if (!map.value || !markerClusterGroup.value) return;

  const bounds = markerClusterGroup.value.getBounds();
  if (bounds.isValid()) {
    map.value.fitBounds(bounds, { padding: [50, 50] });
  }
};

const zoomToCamera = (camera) => {
  if (!map.value) return;

  map.value.setView([camera.latitude, camera.longitude], 18);

  markerClusterGroup.value.eachLayer((layer) => {
    const latLng = layer.getLatLng();
    if (latLng.lat === camera.latitude && latLng.lng === camera.longitude) {
      layer.openPopup();
    }
  });
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [camerasSnap, assignmentsSnap, officersSnap] = await Promise.all([
      getDocs(query(collection(db, "cameras"))),
      getDocs(query(collection(db, "assignments"))),
      getDocs(query(collection(db, "officers"))),
    ]);

    cameras.value = [];
    camerasSnap.forEach((doc) => {
      cameras.value.push({ id: doc.id, ...doc.data() });
    });

    assignments.value = [];
    assignmentsSnap.forEach((doc) => {
      assignments.value.push({ id: doc.id, ...doc.data() });
    });

    officers.value = [];
    officersSnap.forEach((doc) => {
      officers.value.push(doc.data());
    });
  } catch (e) {
    console.error("Error fetching data: ", e);
    alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
  } finally {
    loading.value = false;
  }
};

const handleRefresh = async () => {
  await fetchData();
  initMap();
};

watch([searchQuery, filterStatus], () => {
  updateMarkers();
});

onMounted(async () => {
  fixLeafletIcon();
  await fetchData();
  initMap();
});

onBeforeUnmount(() => {
  destroyMap();
});
</script>

<template>
  <div class="py-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-base-content mb-2">
          แผนที่จุดติดตั้งกล้อง
        </h2>
        <p class="text-base-content/70">แสดงตำแหน่งกล้องวงจรปิดทั้งหมดในระบบ</p>
      </div>

      <div class="flex gap-2 hidden md:flex">
        <button @click="handleRefresh" class="btn btn-ghost gap-2" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5" :class="{ 'animate-spin': loading }">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          รีเฟรช
        </button>
        <button @click="fitBounds" class="btn btn-primary gap-2" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          ดูทั้งหมด
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col justify-center items-center py-20">
      <span class="loading loading-spinner loading-lg text-primary mb-4"></span>
      <p class="text-base-content/70">กำลังโหลดข้อมูล...</p>
    </div>

    <div v-else>
      <!-- Statistics - 6 Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <!-- Card 1: Total -->
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div class="stat-title">กล้องทั้งหมด</div>
            <div class="stat-value text-primary">{{ stats.total }}</div>
            <div class="stat-desc">มีพิกัดในระบบ</div>
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
            <div class="stat-value text-success">{{ stats.assigned }}</div>
            <div class="stat-desc">
              {{ stats.total > 0 ? Math.round((stats.assigned / stats.total) * 100) : 0 }}% ของทั้งหมด
            </div>
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
            <div class="stat-value text-warning">{{ stats.unassigned }}</div>
            <div class="stat-desc">รอการมอบหมาย</div>
          </div>
        </div>

        <!-- 👇 Card 4: 4G Cameras (ใหม่) -->
        <div class="stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-primary">
              <div class="text-4xl">📡</div>
            </div>
            <div class="stat-title">กล้อง 4G</div>
            <div class="stat-value text-primary">{{ cameraTypeStats.camera4G }}</div>
            <div class="stat-desc">
              {{ stats.total > 0 ? Math.round((cameraTypeStats.camera4G / stats.total) * 100) : 0 }}% ของทั้งหมด
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
            <div class="stat-value text-info">{{ cameraTypeStats.cameraWIFI }}</div>
            <div class="stat-desc">
              {{ stats.total > 0 ? Math.round((cameraTypeStats.cameraWIFI / stats.total) * 100) : 0 }}% ของทั้งหมด
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
            <div class="stat-value text-warning">{{ cameraTypeStats.cameraTactical }}</div>
            <div class="stat-desc">
              {{ stats.total > 0 ? Math.round((cameraTypeStats.cameraTactical / stats.total) * 100) : 0 }}% ของทั้งหมด
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card bg-base-100 shadow-md mb-6">
        <div class="card-body p-4">
          <div class="flex flex-col md:flex-row gap-4 md:items-end">
            <div class="form-control w-full md:flex-1">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="ค้นหาชื่อกล้อง หรือ UID..."
                class="input input-bordered w-full"
              />
            </div>

            <div class="form-control w-full md:w-auto md:flex-row md:items-center md:gap-2">
              <label class="label md:p-0">
                <span class="label-text font-semibold pe-2 ps-2">สถานะ</span>
              </label>
              <select v-model="filterStatus" class="select select-bordered w-full md:w-auto">
                <option value="all">ทั้งหมด ({{ stats.total }})</option>
                <option value="assigned">มอบหมายแล้ว ({{ stats.assigned }})</option>
                <option value="unassigned">ยังไม่มอบหมาย ({{ stats.unassigned }})</option>
              </select>

              <button
                v-if="searchQuery || filterStatus !== 'all'"
                @click="searchQuery = ''; filterStatus = 'all';"
                class="btn btn-error btn-sm mt-2 md:mt-0 w-full md:w-auto md:ms-2"
              >
                ล้างตัวกรอง
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile Buttons -->
      <div class="flex gap-2 mb-2 md:hidden">
        <button @click="handleRefresh" class="btn btn-ghost gap-2" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5" :class="{ 'animate-spin': loading }">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          รีเฟรช
        </button>
        <button @click="fitBounds" class="btn btn-primary gap-2" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          ดูทั้งหมด
        </button>
      </div>

      <!-- Map -->
      <div class="card bg-base-100 shadow-lg mb-6">
        <div class="card-body p-0">
          <div id="map" class="w-full h-[600px] rounded-lg"></div>
        </div>
      </div>

      <!-- Camera List (Sidebar) -->
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <h3 class="card-title mb-4">
            รายการกล้อง ({{ filteredCameras.length }})
          </h3>

          <div v-if="filteredCameras.length === 0" class="text-center py-10 text-base-content/50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p>ไม่พบกล้องที่ค้นหา</p>
          </div>

          <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
            <div
              v-for="camera in filteredCameras"
              :key="camera.id"
              class="flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-300 cursor-pointer transition-colors"
              @click="zoomToCamera(camera)"
            >
              <div class="flex items-center gap-3 flex-1">
                <div class="w-2 h-2 rounded-full" :class="isAssigned(camera.cameraID) ? 'bg-success' : 'bg-warning'"></div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold truncate">{{ camera.cameraName }}</div>
                  <div class="text-xs text-base-content/70 truncate">{{ camera.cameraID }}</div>
                </div>
              </div>

              <button class="btn btn-ghost btn-sm btn-circle">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.leaflet-popup-content-wrapper {
  border-radius: 0.5rem;
}

.leaflet-popup-content {
  margin: 0;
}

.custom-marker {
  background: transparent;
  border: none;
}

.marker-cluster-small,
.marker-cluster-medium,
.marker-cluster-large {
  background-color: rgba(16, 185, 129, 0.6) !important;
}

.marker-cluster-small div,
.marker-cluster-medium div,
.marker-cluster-large div {
  background-color: rgba(16, 185, 129, 0.8) !important;
  color: white !important;
  font-weight: bold !important;
  font-size: 14px !important;
}

.marker-cluster div span {
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5) !important;
}

/* 👇 Custom Badge Colors ตรงกับสีหมุด */
.badge-4g {
  background-color: #ef4444 !important;
  color: white !important;
  border-color: #ef4444 !important;
}

.badge-wifi {
  background-color: #06b6d4 !important;
  color: white !important;
  border-color: #06b6d4 !important;
}

.badge-tactical {
  background-color: #eab308 !important;
  color: white !important;
  border-color: #eab308 !important;
}
</style>