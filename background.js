// 小红书笔记收集器 - 后台脚本

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToFeishu') {
    handleSaveToFeishu(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放
  }
});

// 处理保存到飞书的请求
async function handleSaveToFeishu(noteData) {
  try {
    const config = await getFeishuConfig();
    if (!config.appId || !config.appSecret || !config.appToken || !config.tableId) {
      throw new Error('请先在插件设置中配置飞书应用信息');
    }

    const accessToken = await getAccessToken(config.appId, config.appSecret);
    await saveToFeishuTable(accessToken, config.appToken, config.tableId, noteData);
    
    return { success: true };
  } catch (error) {
    console.error('Save to Feishu failed:', error);
    return { success: false, error: error.message };
  }
}

// 获取飞书配置
async function getFeishuConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['feishuAppId', 'feishuAppSecret', 'feishuAppToken', 'feishuTableId'], (result) => {
      resolve({
        appId: result.feishuAppId || '',
        appSecret: result.feishuAppSecret || '',
        appToken: result.feishuAppToken || '',
        tableId: result.feishuTableId || ''
      });
    });
  });
}

// 获取飞书访问令牌
async function getAccessToken(appId, appSecret) {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取访问令牌失败: ${data.msg}`);
  }

  return data.tenant_access_token;
}

// 上传图片到飞书云文档
async function uploadImageToFeishu(accessToken, appToken, imageUrl) {
  if (!imageUrl) return null;
  
  try {
    // 下载图片
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    
    // 准备上传表单
    const formData = new FormData();
    formData.append('file_name', 'cover.jpg');
    formData.append('parent_type', 'bitable_image');
    formData.append('parent_node', appToken); // 使用云文档token
    formData.append('size', imageBlob.size);
    formData.append('file', imageBlob);
    
    // 上传到飞书
    const uploadResponse = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });
    
    const uploadData = await uploadResponse.json();
    if (uploadData.code !== 0) {
      console.error('Upload image failed:', uploadData);
      return null;
    }
    
    return uploadData.data.file_token;
  } catch (error) {
    console.error('Upload image error:', error);
    return null;
  }
}

// 保存数据到飞书多维表格
async function saveToFeishuTable(accessToken, appToken, tableId, noteData) {
  // 上传封面图片
  const coverFileToken = await uploadImageToFeishu(accessToken, appToken, noteData.cover);
  
  const fields = {
    '标题': noteData.title,
    '内容': noteData.content,
    '点赞数': noteData.likes,
    '收藏数': noteData.collects,
    '评论数': noteData.comments,
    '原文链接': {
      text: noteData.title || '小红书笔记',
      link: noteData.url
    }
  };
  
  // 如果上传成功，添加封面附件
  if (coverFileToken) {
    fields['封面'] = [{
      file_token: coverFileToken
    }];
  }
  
  const createResponse = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  const createData = await createResponse.json();
  if (createData.code !== 0) {
    throw new Error(`保存数据失败: ${JSON.stringify(createData)}`);
  }

  return createData;
}
