/**
 * 即時水位（水利署 WRA OpenData）
 * 實際抓取由 index.html 的 loadRealtimeWaterLevels() 負責；本模組負責側欄 UI。
 */

class RealtimeWaterLevelSystem {
  constructor() {
    this.lastUpdate = null;
    this.lastSource = '';
    this.isUpdating = false;
    console.log('🌊 即時水位 UI 模組已載入（資料源：WRA）');
  }

  async fetchWaterLevelData() {
    if (typeof window.loadRealtimeWaterLevels === 'function') {
      return window.loadRealtimeWaterLevels();
    }
    throw new Error('loadRealtimeWaterLevels 未定義');
  }

  startAutoUpdate() {
    if (typeof window.loadRealtimeWaterLevels === 'function') {
      window.loadRealtimeWaterLevels();
    }
  }

  stopAutoUpdate() {}

  async manualUpdate() {
    if (this.isUpdating) return;
    this.isUpdating = true;
    this.updateStatusIndicator('pending', '更新中…');
    try {
      const data = await this.fetchWaterLevelData();
      const n = Object.keys(data || {}).length;
      this.lastUpdate = new Date();
      if (n > 0) {
        this.showSuccessNotification(`已更新 ${n} 站水位`);
      } else {
        this.updateStatusIndicator('error', '未取得任何站點資料');
      }
      return data;
    } catch (error) {
      this.showErrorNotification(`更新失敗: ${error.message}`);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  getStationData(stationId) {
    return (window.realtimeWaterLevels || {})[stationId] || null;
  }

  getAllStationData() {
    return window.realtimeWaterLevels || {};
  }

  getUpdateStatus() {
    const data = this.getAllStationData();
    return {
      isUpdating: this.isUpdating,
      lastUpdate: this.lastUpdate,
      stationCount: Object.keys(data).length,
      source: this.lastSource,
    };
  }

  renderStationList(data, source) {
    this.lastSource = source || '';
    if (typeof window.renderWaterLevelSidebar === 'function') {
      window.renderWaterLevelSidebar(data, source);
      return;
    }
    const list = document.getElementById('waterLevelStationList');
    const stations = window.WATER_LEVEL_STATIONS || [];
    const n = Object.keys(data).length;

    if (list && stations.length) {
      list.innerHTML = stations
        .map((s) => {
          const rt = data[s.stationid];
          let valHtml = '<span class="wl-na">—</span>';
          if (rt && rt.waterlevel !== '' && rt.waterlevel != null) {
            valHtml = `<span class="wl-val">${parseFloat(rt.waterlevel).toFixed(2)} m</span>`;
          }
          return `<li><span class="wl-name" title="${s.name}">${s.name}</span>${valHtml}</li>`;
        })
        .join('');
    }

    const status = document.getElementById('waterLevelStatus');
    if (status) {
      if (n > 0) {
        const snap = source === 'WRA_SNAPSHOT' ? '（部署快照）' : '';
        status.className = 'status-indicator success';
        status.textContent = `已更新 ${n}/${stations.length || n} 站${snap}`;
        status.style.opacity = '1';
      } else {
        status.className = 'status-indicator error';
        status.textContent = '尚無即時資料';
      }
    }

    const lastUpdateEl = document.getElementById('lastWaterUpdate');
    if (lastUpdateEl) {
      this.lastUpdate = new Date();
      lastUpdateEl.textContent = this.lastUpdate.toLocaleString('zh-TW');
    }
  }

  dispatchUpdateEvent(data) {
    window.dispatchEvent(
      new CustomEvent('waterLevelUpdated', {
        detail: {
          data,
          timestamp: new Date(),
          stationCount: Object.keys(data).length,
        },
      })
    );
  }

  showSuccessNotification(message) {
    console.log(`✅ ${message}`);
    this.updateStatusIndicator('success', message);
  }

  showErrorNotification(message) {
    console.error(`❌ ${message}`);
    this.updateStatusIndicator('error', message);
  }

  updateStatusIndicator(type, message) {
    const indicator = document.getElementById('waterLevelStatus');
    if (!indicator) return;
    indicator.className = `status-indicator ${type}`;
    indicator.textContent = message;
    indicator.style.opacity = '1';
    if (type === 'success') {
      setTimeout(() => {
        indicator.style.opacity = '0.85';
      }, 4000);
    }
  }

  createStatusPanel() {
    /* 面板已寫在 index.html，避免 GitHub Pages 快取舊 JS 導致列表不顯示 */
  }
}

window.waterLevelSystem = new RealtimeWaterLevelSystem();
