// 小红书笔记收集器 - 内容脚本
class XHSCollector {
  constructor() {
    this.isDetailPage = false;
    this.saveButton = null;
    this.observer = null;
    this.buttonWatcher = null;
    this.init();
  }

  init() {
    console.log('XHS Collector initialized');
    this.checkPageType();
    this.setupPageObserver();
  }

  // 检查是否为详情页面
  checkPageType() {
    const isDetailPage = this.isXHSDetailPage();
    if (isDetailPage && !this.isDetailPage) {
      this.isDetailPage = true;
      this.injectSaveButton();
    } else if (!isDetailPage && this.isDetailPage) {
      console.log('**** 222222');
      this.isDetailPage = false;
      this.removeSaveButton();
    }
  }

  // 判断是否为小红书详情页面
  isXHSDetailPage() {
    // 检查URL是否包含详情页特征
    const url = window.location.href;
    const hasDetailInUrl = url.includes('/explore/') || url.includes('/discovery/item/');
    
    // 检查页面是否有详情页特征元素
    const hasDetailTitle = document.getElementById('detail-title');
    const hasDetailDesc = document.getElementById('detail-desc');
    
    return hasDetailInUrl && (hasDetailTitle || hasDetailDesc);
  }

  // 设置页面变化监听器
  setupPageObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        // 检查是否有新增的详情页元素
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.id === 'detail-title' || node.id === 'detail-desc' ||
                  node.querySelector && (node.querySelector('#detail-title') || node.querySelector('#detail-desc'))) {
                shouldCheck = true;
              }
            }
          });
        }
      });
      
      if (shouldCheck) {
        setTimeout(() => this.checkPageType(), 500);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听URL变化（SPA路由）
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => this.checkPageType(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // 注入保存按钮
  injectSaveButton() {
    console.log('**** Injecting save button');
    if (this.saveButton) return;

    this.doInjectButton();
  }

  doInjectButton() {
    if (this.saveButton) return;

    // 创建保存按钮容器
    this.saveButton = document.createElement('div');
    this.saveButton.className = 'xhs-save-button';
    this.saveButton.innerHTML = `
      <div class="xhs-float-ball">
        <div class="xhs-click-area">
          <div class="xhs-ball-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="2" cy="2" r="1"/>
              <circle cx="6" cy="2" r="1"/>
              <circle cx="10" cy="2" r="1"/>
              <circle cx="2" cy="6" r="1"/>
              <circle cx="6" cy="6" r="1"/>
              <circle cx="10" cy="6" r="1"/>
              <circle cx="2" cy="10" r="1"/>
              <circle cx="6" cy="10" r="1"/>
              <circle cx="10" cy="10" r="1"/>
            </svg>
          </div>
          <div class="xhs-ball-text">保存到飞书</div>
        </div>
      </div>
    `;

    // 添加拖拽功能（通过图标区域）
    this.makeDraggable(this.saveButton);
    
    // 添加点击事件（只给文字区域添加）
    const ballText = this.saveButton.querySelector('.xhs-ball-text');
    ballText.addEventListener('click', () => this.handleSave());

    // 使用固定定位，贴右边界
    this.saveButton.style.position = 'fixed';
    this.saveButton.style.top = '50%';
    this.saveButton.style.right = '0px';
    this.saveButton.style.transform = 'translateY(-50%)';
    this.saveButton.style.zIndex = '9999';
    
    document.body.appendChild(this.saveButton);
    
    console.log('Float ball button injected');
  }

  // 添加拖拽功能（只能垂直拖动）
  makeDraggable(element) {
    let isDragging = false;
    let startY, initialY;
    
    const dragArea = element.querySelector('.xhs-ball-icon');

    dragArea.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      initialY = element.offsetTop;
      
      element.style.userSelect = 'none';
      element.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaY = e.clientY - startY;
      const newY = initialY + deltaY;
      
      // 限制在视窗垂直范围内
      const maxY = window.innerHeight - element.offsetHeight;
      
      element.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
      element.style.transform = 'none'; // 拖拽时移除居中变换
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.userSelect = 'auto';
        element.classList.remove('dragging');
      }
    });
  }

  // 移除保存按钮
  removeSaveButton() {
    console.log('**** Removing save button');
    if (this.saveButton) {
      this.saveButton.remove();
      this.saveButton = null;
    }
  }

  // 处理保存操作
  async handleSave() {
    const ballIcon = this.saveButton.querySelector('.xhs-ball-icon');
    const ballText = this.saveButton.querySelector('.xhs-ball-text');
    const originalIcon = ballIcon.innerHTML;
    const originalText = ballText.innerHTML;
    
    try {
      // 显示加载状态
      ballIcon.innerHTML = '⏳';
      ballText.innerHTML = '保存中...';

      // 提取数据
      const noteData = this.extractNoteData();
      console.log('Extracted data:', noteData);

      // 发送到background script处理
      const response = await chrome.runtime.sendMessage({
        action: 'saveToFeishu',
        data: noteData
      });

      if (response.success) {
        ballIcon.innerHTML = '✓';
        ballText.innerHTML = '已保存';
        setTimeout(() => {
          ballIcon.innerHTML = originalIcon;
          ballText.innerHTML = originalText;
        }, 2000);
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('Save failed:', error);
      ballIcon.innerHTML = '✗';
      ballText.innerHTML = '保存失败';
      setTimeout(() => {
        ballIcon.innerHTML = originalIcon;
        ballText.innerHTML = originalText;
      }, 2000);
    }
  }

  // 提取笔记数据
  extractNoteData() {
    const data = {
      title: this.getTitle(),
      content: this.getContent(),
      likes: this.getLikes(),
      collects: this.getCollects(),
      comments: this.getComments(),
      cover: this.getCoverImage(),
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    return data;
  }

  getTitle() {
    const titleEl = document.getElementById('detail-title');
    return titleEl ? titleEl.textContent.trim() : '';
  }

  getContent() {
    const contentEl = document.getElementById('detail-desc');
    return contentEl ? contentEl.textContent.trim() : '';
  }

  getLikes() {
    const likeEl = document.querySelector('.engage-bar-container .like-wrapper');
    return likeEl?.textContent?.trim() || '0';
  }

  getCollects() {
    const collectEl = document.querySelector('.engage-bar-container .collect-wrapper');
    return collectEl?.textContent?.trim() || '0';
  }

  getComments() {
    const commentEl = document.querySelector('.engage-bar-container .chat-wrapper');
    return commentEl?.textContent?.trim() || '0';
  }

  getCoverImage() {
    // 检查是否为视频
    if (document.querySelector('.player-container')) {
      const posterEl = document.querySelector('.xgplayer-poster');
      if (posterEl) {
        const style = posterEl.style.backgroundImage;
        const match = style.match(/url\("(.+?)"\)/);
        return match ? match[1] : '';
      }
    } else {
      // 图文模式
      const img = document.querySelector('.swiper-slide[data-index="0"] img');
      return img ? img.src : '';
    }
    return '';
  }

  // 提取数字（处理1.2w这种格式）
  extractNumber(text) {
    if (!text) return 0;
    const match = text.match(/(\d+\.?\d*)(w|万)?/);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2];
      return unit === 'w' || unit === '万' ? Math.floor(num * 10000) : Math.floor(num);
    }
    return 0;
  }
}

// 初始化收集器
const collector = new XHSCollector();
