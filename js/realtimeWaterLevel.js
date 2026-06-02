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
    const host = document.getElementById('waterLevelPanelHost');
    if (!host) return;

    const existing = document.getElementById('waterLevelStatusPanel');
    if (existing) {
      if (existing.parentElement !== host) host.appendChild(existing);
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'waterLevelStatusPanel';
    panel.innerHTML = `
      <div class="water-status-panel">
        <div class="status-header"><span>💧 即時水位</span></div>
        <div id="waterLevelStatus" class="status-indicator">準備中…</div>
        <ul id="waterLevelStationList" class="wl-station-list"></ul>
        <div class="status-info">
          <small>最後更新: <span id="lastWaterUpdate">--</span></small>
        </div>
        <div class="status-hint">資料來源：水利署 WRA · 請用上方「立即更新」</div>
      </div>
    `;

    if (!document.getElementById('water-level-panel-styles')) {
      const style = document.createElement('style');
      style.id = 'water-level-panel-styles';
      style.textContent = `
        .water-status-panel {
          width: 100%;
          box-sizing: border-box;
          background: #f5f9fc;
          border: 1px solid #d6e4f0;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .status-header {
          font-weight: 600;
          font-size: 0.8rem;
          color: #1a5276;
          margin-bottom: 6px;
        }
        .status-indicator {
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 0.78rem;
          margin-bottom: 4px;
        }
        .status-indicator.success { background: #d4edda; color: #155724; }
        .status-indicator.error { background: #f8d7da; color: #721c24; }
        .status-indicator.pending { background: #fff3cd; color: #856404; }
        .status-info { font-size: 0.68rem; color: #666; text-align: center; margin-top: 4px; }
        .status-hint { font-size: 0.65rem; color: #888; text-align: center; margin-top: 6px; }
      `;
      document.head.appendChild(style);
    }
    host.appendChild(panel);
  }
}

window.waterLevelSystem = new RealtimeWaterLevelSystem();
