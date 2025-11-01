import { createRouter, createWebHistory } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";

// 1. Import หน้า Page Components
const Login = () => import("../views/Login.vue");
const Dashboard = () => import("../views/Dashboard.vue");
const AdminLayout = () => import("../views/AdminLayout.vue");
const AdminReportDashboard = () => import("../views/admin/AdminReportDashboard.vue");
const AdminAssignments = () => import("../views/admin/AdminAssignments.vue");
const AdminOfficers = () => import('../views/admin/AdminOfficers.vue');
const AdminCameras = () => import('../views/admin/AdminCameras.vue'); // 👈 (ใหม่!)

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
        path: "cameras", // 👈 (ใหม่!) Path: /admin/cameras
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
  const currentUser = await getCurrentUser();

  let isAdmin = false;

  if (currentUser) {
    try {
      const adminDoc = await getDoc(doc(db, "admins", currentUser.uid));
      if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
        isAdmin = true;
      }
    } catch (e) {
      console.error("Error checking admin status:", e);
    }
  }

  if (requiresAuth && !currentUser) {
    next("/login");
  } else if (!requiresAuth && currentUser) {
    next("/");
  } else if (requiresAdmin && !isAdmin) {
    console.warn("Access Denied: User is not an admin.");
    next("/");
  } else {
    next();
  }
});

export default router;