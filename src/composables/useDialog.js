// src/composables/useDialog.js
import { ref } from 'vue';

export function useDialog() {
  /**
   * แสดง Confirmation Dialog
   * @param {Object} options - ตัวเลือกสำหรับ dialog
   * @param {string} options.title - หัวข้อ dialog
   * @param {string} options.message - ข้อความ
   * @param {string} options.confirmText - ข้อความปุ่มยืนยัน (default: 'ยืนยัน')
   * @param {string} options.cancelText - ข้อความปุ่มยกเลิก (default: 'ยกเลิก')
   * @param {string} options.type - ประเภท: 'warning', 'error', 'info', 'success' (default: 'warning')
   * @returns {Promise<boolean>} - true ถ้ากดยืนยัน, false ถ้ากดยกเลิก
   */
  const showConfirm = (options = {}) => {
    return new Promise((resolve) => {
      const {
        title = 'ยืนยันการดำเนินการ',
        message = 'คุณแน่ใจหรือไม่?',
        confirmText = 'ยืนยัน',
        cancelText = 'ยกเลิก',
        type = 'warning'
      } = options;

      const dialog = document.createElement('dialog');
      dialog.className = 'modal modal-bottom sm:modal-middle';
      
      // เลือก icon และสีตาม type
      const typeConfig = {
        warning: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>`,
          btnClass: 'btn-warning'
        },
        error: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
          btnClass: 'btn-error'
        },
        info: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
          btnClass: 'btn-info'
        },
        success: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
          btnClass: 'btn-success'
        }
      };

      const config = typeConfig[type] || typeConfig.warning;

      dialog.innerHTML = `
        <div class="modal-box">
          <div class="flex items-start gap-4 mb-4">
            ${config.icon}
            <div class="flex-1">
              <h3 class="font-bold text-lg mb-2">${title}</h3>
              <p class="text-base-content/80">${message}</p>
            </div>
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" data-action="cancel">${cancelText}</button>
            <button class="btn ${config.btnClass}" data-action="confirm">
              ${confirmText}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button data-action="cancel">close</button>
        </form>
      `;

      document.body.appendChild(dialog);
      dialog.showModal();

      const cleanup = (result) => {
        dialog.close();
        setTimeout(() => {
          dialog.remove();
        }, 200);
        resolve(result);
      };

      const handleClick = (e) => {
        const action = e.target.dataset.action;
        if (action === 'confirm') {
          cleanup(true);
        } else if (action === 'cancel') {
          cleanup(false);
        }
      };

      dialog.addEventListener('click', handleClick);
      dialog.addEventListener('close', () => cleanup(false));
    });
  };

  /**
   * แสดง Alert Dialog
   * @param {string} message - ข้อความที่ต้องการแสดง
   * @param {Object} options - ตัวเลือกเพิ่มเติม
   * @param {string} options.title - หัวข้อ (default: ตาม type)
   * @param {string} options.type - ประเภท: 'info', 'success', 'warning', 'error' (default: 'info')
   * @param {string} options.buttonText - ข้อความปุ่ม (default: 'ตกลง')
   * @returns {Promise<void>}
   */
  const showAlert = (message, options = {}) => {
    return new Promise((resolve) => {
      const {
        title,
        type = 'info',
        buttonText = 'ตกลง'
      } = options;

      const dialog = document.createElement('dialog');
      dialog.className = 'modal modal-bottom sm:modal-middle';

      const typeConfig = {
        info: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
          defaultTitle: 'แจ้งเตือน',
          btnClass: 'btn-info'
        },
        success: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
          defaultTitle: 'สำเร็จ',
          btnClass: 'btn-success'
        },
        warning: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>`,
          defaultTitle: 'คำเตือน',
          btnClass: 'btn-warning'
        },
        error: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
          defaultTitle: 'เกิดข้อผิดพลาด',
          btnClass: 'btn-error'
        }
      };

      const config = typeConfig[type] || typeConfig.info;
      const dialogTitle = title || config.defaultTitle;

      dialog.innerHTML = `
        <div class="modal-box">
          <div class="flex items-start gap-4 mb-4">
            ${config.icon}
            <div class="flex-1">
              <h3 class="font-bold text-lg mb-2">${dialogTitle}</h3>
              <p class="text-base-content/80">${message}</p>
            </div>
          </div>
          <div class="modal-action">
            <button class="btn ${config.btnClass}" data-action="ok">
              ${buttonText}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button data-action="ok">close</button>
        </form>
      `;

      document.body.appendChild(dialog);
      dialog.showModal();

      const cleanup = () => {
        dialog.close();
        setTimeout(() => {
          dialog.remove();
        }, 200);
        resolve();
      };

      const handleClick = (e) => {
        if (e.target.dataset.action === 'ok') {
          cleanup();
        }
      };

      dialog.addEventListener('click', handleClick);
      dialog.addEventListener('close', cleanup);
    });
  };

  /**
   * แสดง Toast Notification
   * @param {string} message - ข้อความที่ต้องการแสดง
   * @param {string} type - ประเภท: 'success', 'error', 'warning', 'info' (default: 'success')
   * @param {number} duration - ระยะเวลาแสดง (มิลลิวินาที) (default: 3000)
   */
  const showToast = (message, type = 'success', duration = 3000) => {
    const alertClass = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info'
    }[type] || 'alert-success';

    const iconMap = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`,
      error: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`,
      warning: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`
    };

    const toast = document.createElement('div');
    toast.className = 'toast toast-top toast-end z-50';
    toast.innerHTML = `
      <div class="alert ${alertClass} shadow-lg">
        ${iconMap[type] || iconMap.success}
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(toast);

    // Fade in animation
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  };

  return {
    showConfirm,
    showAlert,
    showToast
  };
}