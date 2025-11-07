import { createRouter, createWebHistory } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";

// 1. Import หน้า Page Components
const Login = () => import("../views/Login.vue");
const Dashboard = () => import("../views/Dashboard.vue");
const AdminLayout = () => import("../views/AdminLayout.vue");
const InspectorLayout = () => import("../views/InspectorLayout.vue");
const AdminReportDashboard = () =>
  import("../views/admin/AdminReportDashboard.vue");
const AdminAssignments = () => import("../views/admin/AdminAssignments.vue");
const AdminOfficers = () => import("../views/admin/AdminOfficers.vue");
const AdminCameras = () => import("../views/admin/AdminCameras.vue");
const AdminUserManagement = () =>
  import("../views/admin/AdminUserManagement.vue"); // ใหม่!
const InspectorReports = () =>
  import("../views/inspector/InspectorReports.vue");
const InspectorCameras = () =>
  import("../views/inspector/InspectorCameras.vue");
const AdminCameraMap = () => import("../views/admin/AdminCameraMap.vue");
const InspectorCameraMap = () =>
  import("../views/inspector/InspectorCameraMap.vue");

// 2. กำหนด "เส้นทาง" (Routes)
const routes = [
  {
    path: "/",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    redirect: "/admin/reports",
    children: [
      {
        path: "reports",
        name: "AdminReports",
        component: AdminReportDashboard,
      },
      {
        path: "cameras",
        name: "AdminCameras",
        component: AdminCameras,
      },
      {
        path: "assignments",
        name: "AdminAssignments",
        component: AdminAssignments,
      },
      {
        path: "officers",
        name: "AdminOfficers",
        component: AdminOfficers,
      },
      {
        path: "users", // ใหม่!
        name: "AdminUserManagement",
        component: AdminUserManagement,
      },
      {
        path: "map",
        name: "AdminCameraMap",
        component: AdminCameraMap,
      },
    ],
  },
  {
    path: "/inspector",
    component: InspectorLayout,
    meta: { requiresAuth: true, requiresInspector: true },
    redirect: "/inspector/reports",
    children: [
      {
        path: "reports",
        name: "InspectorReports",
        component: InspectorReports,
      },
      {
        path: "cameras",
        name: "InspectorCameras",
        component: InspectorCameras,
      },
      {
        path: "map", // 👈 เพิ่มใหม่
        name: "InspectorCameraMap",
        component: InspectorCameraMap,
      },
    ],
  },
];

// 3. สร้าง Router
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 4. Navigation Guard
const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const removeListener = onAuthStateChanged(
      auth,
      (user) => {
        removeListener();
        resolve(user);
      },
      reject
    );
  });
};

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin);
  const requiresInspector = to.matched.some(
    (record) => record.meta.requiresInspector
  );
  const currentUser = await getCurrentUser();

  let isAdmin = false;
  let isInspector = false;

  if (currentUser) {
    try {
      // เช็ค Admin ด้วย Email (แทน UID)
      const adminDoc = await getDoc(doc(db, "admins", currentUser.email));
      if (adminDoc.exists()) {
        isAdmin = true;
      }

      // เช็ค Inspector ด้วย Email
      if (!isAdmin) {
        const inspectorDoc = await getDoc(
          doc(db, "inspectors", currentUser.email)
        );
        if (inspectorDoc.exists()) {
          isInspector = true;
        }
      }
    } catch (e) {
      console.error("Error checking user roles:", e);
    }
  }

  if (requiresAuth && !currentUser) {
    next("/login");
  } else if (!requiresAuth && currentUser) {
    next("/");
  } else if (requiresAdmin && !isAdmin) {
    console.warn("Access Denied: User is not an admin.");
    next("/");
  } else if (requiresInspector && !isInspector) {
    console.warn("Access Denied: User is not an inspector.");
    next("/");
  } else {
    next();
  }
});

export default router;
