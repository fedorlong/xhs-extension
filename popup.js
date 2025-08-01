// 小红书笔记收集器 - 弹窗脚本

document.addEventListener('DOMContentLoaded', function() {
  const appIdInput = document.getElementById('appId');
  const appSecretInput = document.getElementById('appSecret');
  const appTokenInput = document.getElementById('appToken');
  const tableIdInput = document.getElementById('tableId');
  const saveBtn = document.getElementById('saveConfig');
  const statusDiv = document.getElementById('status');

  // 加载已保存的配置
  loadConfig();

  // 保存配置
  saveBtn.addEventListener('click', saveConfig);

  function loadConfig() {
    chrome.storage.sync.get(['feishuAppId', 'feishuAppSecret', 'feishuAppToken', 'feishuTableId'], function(result) {
      appIdInput.value = result.feishuAppId || '';
      appSecretInput.value = result.feishuAppSecret || '';
      appTokenInput.value = result.feishuAppToken || '';
      tableIdInput.value = result.feishuTableId || '';
    });
  }

  function saveConfig() {
    const appId = appIdInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    const appToken = appTokenInput.value.trim();
    const tableId = tableIdInput.value.trim();

    if (!appId || !appSecret || !appToken || !tableId) {
      showStatus('请填写完整的配置信息', 'error');
      return;
    }

    chrome.storage.sync.set({
      feishuAppId: appId,
      feishuAppSecret: appSecret,
      feishuAppToken: appToken,
      feishuTableId: tableId
    }, function() {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存配置';
      
      if (chrome.runtime.lastError) {
        showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('配置保存成功！', 'success');
      }
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
