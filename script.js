// 1. 先定义所有类
class PomodoroTimer {
    constructor() {
        this.workTime = 25 * 60;
        this.breakTime = 5 * 60;
        this.timeLeft = this.workTime;
        this.isRunning = false;
        this.isWorkTime = true;
        this.timerId = null;
        this.totalTime = this.workTime;

        // DOM元素
        this.timeDisplay = document.querySelector('.time-display');
        this.statusDisplay = document.querySelector('.status');
        this.startBtn = document.getElementById('start');
        this.pauseBtn = document.getElementById('pause');
        this.resetBtn = document.getElementById('reset');
        this.alertSound = document.getElementById('alert');
        this.progressRing = document.querySelector('.progress-ring__circle');
        
        // 计算进度环周长
        const circumference = 2 * Math.PI * 140;
        this.progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        this.progressRing.style.strokeDashoffset = circumference;

        // 绑定事件
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        // 时间预设按钮
        document.querySelectorAll('.time-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isRunning && !confirm('更改时间将重置当前任务，是否继续？')) {
                    return;
                }
                this.setPresetTime(parseInt(btn.dataset.time));
            });
        });

        // 移除旧的自定义时间事件监听
        document.getElementById('setCustomTime')?.removeEventListener('click', null);

        // 添加自定义时间设置按钮事件
        const workTimeBtn = document.getElementById('setCustomWorkTime');
        const breakTimeBtn = document.getElementById('setCustomBreakTime');
        const workTimeInput = document.getElementById('customWorkTime');
        const breakTimeInput = document.getElementById('customBreakTime');

        if (workTimeBtn && workTimeInput) {
            workTimeBtn.addEventListener('click', () => {
                const time = parseInt(workTimeInput.value);
                if (this.validateCustomTime(time)) {
                    this.setCustomWorkTime(time);
                    workTimeInput.value = '';
                }
            });

            // 添加回车键支持
            workTimeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    workTimeBtn.click();
                }
            });
        }

        if (breakTimeBtn && breakTimeInput) {
            breakTimeBtn.addEventListener('click', () => {
                const time = parseInt(breakTimeInput.value);
                if (this.validateCustomTime(time, true)) {
                    this.setCustomBreakTime(time);
                    breakTimeInput.value = '';
                }
            });

            // 添加回车键支持
            breakTimeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    breakTimeBtn.click();
                }
            });
        }

        // 初始化显示
        this.updateDisplay();

        // 添加任务完成回调
        this.onComplete = null;

        // 记录开始时间
        this.startedAt = null;

        // 添加当前任务引用
        this.currentTask = null;

        // 添加休息提醒弹窗
        this.createBreakReminder();

        // 使用 requestAnimationFrame 优化动画
        this.animationFrameId = null;
        this.lastTimestamp = 0;

        // 添加任务周期标记
        this.cycleCompleted = false;

        // 添加时间设置显示元素引用
        this.currentWorkTimeDisplay = document.getElementById('currentWorkTime');
        this.currentBreakTimeDisplay = document.getElementById('currentBreakTime');

        // 初始化显示当前设置
        this.updateTimeSettingsDisplay();
    }

    validateCustomTime(time, isBreakTime = false) {
        const minTime = isBreakTime ? 1 : 1;
        const maxTime = isBreakTime ? 30 : 120;
        
        if (!time || isNaN(time) || time < minTime || time > maxTime) {
            alert(`请输入${minTime}-${maxTime}之间的数字`);
            return false;
        }
        return true;
    }

    setPresetTime(minutes) {
        if (this.isRunning) {
            this.reset();
            // 重置任务状态
            if (taskManager) {
                taskManager.endTaskFocus();
            }
        }
        
        // 更新预设按钮状态
        document.querySelectorAll('.time-preset').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.time) === minutes);
        });

        this.workTime = minutes * 60;
        this.timeLeft = this.workTime;
        this.totalTime = this.workTime;
        this.isWorkTime = true;
        this.updateDisplay();
        this.updateProgressRing();
        
        // 更新显示的时间设置
        this.updateTimeSettingsDisplay();
    }

    start() {
        if (this.isRunning) return;
        
        // 检查是否有选中的任务
        if (!taskManager.currentTaskId) {
            alert('请先选择一个要专注的任务');
            return;
        }
        
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.startedAt = Date.now();
        
        // 更新任务状态为专注中
        taskManager.startTaskFocus(taskManager.currentTaskId);
        
        this.timerId = setInterval(() => {
            this.timeLeft--;
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timerId);
                this.alertSound.play();
                // 工作时间结束，调用完成方法
                this.completePomodoro();
                return;
            }
            
            this.updateDisplay();
            this.updateProgressRing();
        }, 1000);
    }

    pause() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        clearInterval(this.timerId);
    }

    reset() {
        this.pause();
        this.isWorkTime = true;
        this.timeLeft = this.workTime;
        this.totalTime = this.workTime;
        this.startedAt = null;
        this.isRunning = false;
        this.updateDisplay();
        this.updateProgressRing();
        this.updateTheme();
        this.hideBreakReminder();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.statusDisplay.textContent = this.isWorkTime ? '工作时间' : '休息时间';
    }

    updateProgressRing(timestamp) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = timestamp - this.lastTimestamp;
        
        // 限制更新频率
        if (elapsed < 16) { // 约60fps
            this.animationFrameId = requestAnimationFrame(this.updateProgressRing.bind(this));
            return;
        }

        const circumference = 2 * Math.PI * 140;
        const progress = this.timeLeft / this.totalTime;
        const offset = circumference * (1 - progress);
        this.progressRing.style.strokeDashoffset = offset;

        this.lastTimestamp = timestamp;
        this.animationFrameId = requestAnimationFrame(this.updateProgressRing.bind(this));
    }

    updateTheme() {
        document.body.classList.toggle('work-mode', this.isWorkTime);
        document.body.classList.toggle('break-mode', !this.isWorkTime);
    }

    completePomodoro() {
        if (this.startedAt && this.isWorkTime) {
            // 1. 工作时间结束，暂停计时器
            clearInterval(this.timerId);
            const duration = Math.round((Date.now() - this.startedAt) / 1000);
            
            // 2. 更新任务状态和统计
            if (taskManager.currentTaskId) {
                statsManager.recordPomodoro(taskManager.currentTaskId, duration);
                const task = taskManager.tasks.find(t => t.id === taskManager.currentTaskId);
                if (task) {
                    taskManager.completeTask(taskManager.currentTaskId);
                }
            }
            
            // 3. 显示休息提醒并播放提示音
            this.alertSound.play();
            this.showBreakReminder();
            
            // 4. 开始休息时间
            setTimeout(() => {
                this.startBreakTime();
            }, 500); // 短暂延迟确保提醒显示
            
        } else if (!this.isWorkTime && this.timeLeft <= 0) {
            this.completeBreakTime();
        }
    }

    startBreakTime() {
        // 暂停当前计时器
        clearInterval(this.timerId);
        
        // 切换到休息状态
        this.isWorkTime = false;
        this.timeLeft = this.breakTime;
        this.totalTime = this.breakTime;
        this.startedAt = Date.now();
        
        // 更新显示
        this.updateDisplay();
        this.updateTheme();
        this.updateProgressRing();
        
        // 启动休息时间计时器
        this.isRunning = true;
        this.timerId = setInterval(() => {
            this.timeLeft--;
            
            // 同时更新主计时器和休息提醒的显示
            this.updateDisplay();
            this.updateProgressRing();
            this.updateBreakTimerDisplay();
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timerId);
                this.completePomodoro();
                return;
            }
        }, 1000);
    }

    completeBreakTime() {
        // 清除计时器
        clearInterval(this.timerId);
        this.reset();
        
        // 隐藏休息提醒
        this.hideBreakReminder();
        
        // 切换到下一个任务
        taskManager.switchToNextTask();
        
        // 显示周期完成提示
        this.showCycleCompleteNotification();
    }

    showCycleCompleteNotification() {
        const notification = document.createElement('div');
        notification.className = 'notification cycle-complete';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>🌟 休息时间结束</h4>
                <p>准备开始新的工作吧！</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    createBreakReminder() {
        if (!this.breakReminder) {
            this.breakReminder = document.createElement('div');
            this.breakReminder.className = 'break-reminder';
            this.breakReminder.innerHTML = `
                <div class="break-reminder-content">
                    <h3>🎉 工作时间结束</h3>
                    <p>该休息一下了！</p>
                    <div class="break-timer">05:00</div>
                </div>
            `;
            
            document.body.appendChild(this.breakReminder);
            this.breakTimerDisplay = this.breakReminder.querySelector('.break-timer');
            
            // 添加点击事件，允许用户点击背景关闭提醒
            this.breakReminder.addEventListener('click', (e) => {
                if (e.target === this.breakReminder) {
                    this.hideBreakReminder();
                }
            });
        }
    }

    showBreakReminder() {
        if (this.breakReminder) {
            // 确保弹窗存在并显示
            this.breakReminder.style.display = 'flex';
            
            // 添加震动效果
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
            
            // 初始化休息时间显示
            this.updateBreakTimerDisplay();
            
            // 确保弹窗在最上层
            this.breakReminder.style.zIndex = '1000';
        } else {
            // 如果弹窗不存在，重新创建
            this.createBreakReminder();
            this.showBreakReminder();
        }
    }

    hideBreakReminder() {
        if (this.breakReminder) {
            this.breakReminder.style.display = 'none';
        }
    }

    updateBreakTimerDisplay() {
        if (this.breakTimerDisplay) {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            this.breakTimerDisplay.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // 防抖处理
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    setCustomWorkTime(minutes) {
        if (this.isRunning && !confirm('更改时间将重置当前任务，是否继续？')) {
            return;
        }
        
        this.workTime = minutes * 60;
        this.timeLeft = this.workTime;
        this.totalTime = this.workTime;
        this.reset();
        
        // 更新预设按钮状态
        document.querySelectorAll('.time-preset').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 更新显示的时间设置
        this.updateTimeSettingsDisplay();
        
        // 显示提示
        this.showTimeUpdateNotification('工作时间已更新为 ' + minutes + ' 分钟');
    }

    setCustomBreakTime(minutes) {
        this.breakTime = minutes * 60;
        
        // 如果当前是休息时间，则立即应用新的时间
        if (!this.isWorkTime) {
            if (this.isRunning && !confirm('立即应用新的休息时间？')) {
                return;
            }
            this.timeLeft = this.breakTime;
            this.totalTime = this.breakTime;
            this.updateDisplay();
            this.updateProgressRing();
        }
        
        // 更新显示的时间设置
        this.updateTimeSettingsDisplay();
        
        // 显示提示
        this.showTimeUpdateNotification('休息时间已更新为 ' + minutes + ' 分钟');
    }

    showTimeUpdateNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification time-update';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>⚡ 时间设置已更新</h4>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    updateTimeSettingsDisplay() {
        // 更新显示的时间设置
        if (this.currentWorkTimeDisplay) {
            this.currentWorkTimeDisplay.textContent = `${Math.floor(this.workTime / 60)}分钟`;
        }
        if (this.currentBreakTimeDisplay) {
            this.currentBreakTimeDisplay.textContent = `${Math.floor(this.breakTime / 60)}分钟`;
        }
    }
}

class TaskManager {
    constructor(pomodoroTimer) {
        this.timer = pomodoroTimer;
        this.currentTaskId = null;
        this.confetti = new ConfettiEffect();
        this.tasks = [];
        this.tasksList = document.getElementById('tasksList');
        this.newTaskInput = document.getElementById('newTask');
        this.addTaskBtn = document.getElementById('addTask');

        // 绑定事件
        this.addTaskBtn.addEventListener('click', () => {
            if (!this.newTaskInput.value.trim()) {
                alert('请先创建任务');
                this.newTaskInput.focus();
                return;
            }
            this.addTask();
        });
        this.newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (!this.newTaskInput.value.trim()) {
                    alert('请先创建任务');
                    return;
                }
                this.addTask();
            }
        });
        this.tasksList.addEventListener('click', (e) => {
            const target = e.target;
            const taskElement = target.closest('.task-item');
            if (!taskElement) return;

            const taskId = taskElement.dataset.id;
            const actionElement = target.closest('[data-action]');
            if (!actionElement) return;

            const action = actionElement.dataset.action;
            
            switch(action) {
                case 'edit':
                    this.editTask(taskId);
                    break;
                case 'delete':
                    this.deleteTask(taskId);
                    break;
                case 'toggle':
                    this.toggleTask(taskId);
                    break;
                case 'focus':
                    this.focusTask(taskId);
                    break;
            }
        });
        
        // 拖拽排序
        this.tasksList.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.tasksList.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.tasksList.addEventListener('drop', (e) => this.handleDrop(e));
        this.tasksList.addEventListener('dragend', (e) => this.handleDragEnd(e));

        // 加载保存的任务
        this.loadTasks();

        // 添加任务进度追踪
        this.taskProgress = new Map();

        // 添加任务状态
        this.isTaskFocusing = false;
    }

    loadTasks() {
        try {
            const savedTasks = localStorage.getItem('tasks');
            this.tasks = savedTasks ? JSON.parse(savedTasks) : [];
            this.renderTasks();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
        }
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    renderTasks() {
        this.tasksList.innerHTML = '';
        this.tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            taskElement.dataset.id = task.id;
            
            // 添加任务状态类
            if (task.completed) {
                taskElement.classList.add('completed');
            } else if (task.id === this.currentTaskId && this.isTaskFocusing) {
                taskElement.classList.add('focusing');
            }

            // 更新任务显示
            taskElement.innerHTML = `
                <div class="task-content">
                    <input type="checkbox" 
                           ${task.completed ? 'checked' : ''} 
                           ${this.isTaskFocusing ? 'disabled' : ''}>
                    <span class="task-title">${task.title}</span>
                    ${!task.completed && task.id === this.currentTaskId && this.isTaskFocusing ? 
                      '<span class="task-status">专注中</span>' : ''}
                </div>
                <div class="task-actions">
                    ${!task.completed ? `
                        <button class="task-btn focus-btn" 
                                data-action="focus" 
                                ${task.id === this.currentTaskId && this.isTaskFocusing ? 'disabled' : ''}>
                            <svg viewBox="0 0 24 24">
                                <path d="M12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8zm0-18c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm-1 5v6l5 3-1 2-6-3.5V7h2z"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="task-btn delete-btn" 
                            data-action="delete" 
                            ${this.isTaskFocusing ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            `;

            // 添加事件监听
            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => this.toggleTask(task.id));

            const focusBtn = taskElement.querySelector('[data-action="focus"]');
            if (focusBtn) {
                focusBtn.addEventListener('click', () => this.focusTask(task.id));
            }

            const deleteBtn = taskElement.querySelector('[data-action="delete"]');
            deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

            this.tasksList.appendChild(taskElement);
        });

        Logger.log('Tasks rendered:', this.tasks);
    }

    createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === this.currentTaskId ? 'current' : ''}`;
        taskElement.draggable = true;
        taskElement.dataset.id = task.id;
        
        taskElement.innerHTML = `
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle"></div>
            <div class="task-content">
                ${task.title}
            </div>
            <div class="task-actions">
                ${!task.completed ? `
                    <button class="task-btn focus-btn ${task.id === this.currentTaskId ? 'active' : ''}" 
                            data-action="focus" 
                            title="${task.id === this.currentTaskId ? '正在专注' : '开始专注'}">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8zm0-18c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm-1 5v6l5 3-1 2-6-3.5V7h2z"/>
                        </svg>
                    </button>
                ` : ''}
                <button class="task-btn edit-btn" data-action="edit" title="编辑任务">
                    <svg viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <button class="task-btn delete-btn" data-action="delete" title="删除任务">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        `;
        
        return taskElement;
    }

    addTask() {
        const title = this.newTaskInput.value.trim();
        if (!title) return;

        const task = {
            id: Date.now().toString(),
            title,
            completed: false,
            order: this.tasks.length,
            createdAt: Date.now()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.newTaskInput.value = '';
        
        // 添加成功提示
        this.showNotification('任务添加成功！');
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const newTitle = prompt('编辑任务', task.title);
        if (newTitle === null || newTitle.trim() === '') return;

        task.title = newTitle.trim();
        this.saveTasks();
        this.renderTasks();
    }

    deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        // 标记任务为已删除
        task.deleted = true;
        task.deletedAt = Date.now();
        
        // 如果删除的是当前专注的任务，重置计时器
        if (taskId === this.currentTaskId) {
            this.currentTaskId = null;
            this.timer.reset();
        }
        
        // 从显示列表中移除
        this.tasks = this.tasks.filter(t => !t.deleted);
        this.saveTasks();
        this.renderTasks();
        
        // 清理统计数据
        statsManager.cleanDeletedTaskStats();
    }

    toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.completed = !task.completed;
        
        if (task.completed) {
            task.completedAt = Date.now();
            // 如果是当前专注的任务，重置状态
            if (taskId === this.currentTaskId) {
                this.isTaskFocusing = false;
                this.currentTaskId = null;
            }
            // 记录任务完成统计
            statsManager.recordTaskCompletion(task);
        }

        this.saveTasks();
        this.renderTasks();
    }

    handleDragStart(e) {
        const taskElement = e.target.closest('.task-item');
        if (!taskElement) return;

        taskElement.classList.add('dragging');
        e.dataTransfer.setData('text/plain', taskElement.dataset.id);
    }

    handleDragOver(e) {
        e.preventDefault();
        const taskElement = e.target.closest('.task-item');
        if (!taskElement || taskElement.classList.contains('dragging')) return;

        const draggingElement = this.tasksList.querySelector('.dragging');
        if (!draggingElement) return;

        const rect = taskElement.getBoundingClientRect();
        const afterElement = (e.clientY - rect.top) > (rect.height / 2);

        if (afterElement) {
            taskElement.after(draggingElement);
        } else {
            taskElement.before(draggingElement);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const taskElements = Array.from(this.tasksList.children);
        this.tasks.forEach(task => {
            const index = taskElements.findIndex(el => el.dataset.id === task.id);
            task.order = index;
        });
        this.saveTasks();
    }

    handleDragEnd(e) {
        const taskElement = e.target.closest('.task-item');
        if (!taskElement) return;
        taskElement.classList.remove('dragging');
    }

    focusTask(taskId) {
        if (this.timer.isRunning) {
            if (!confirm('正在进行中的番茄钟将被重置，是否继续？')) {
                return;
            }
            this.timer.reset();
        }

        this.currentTaskId = taskId;
        this.renderTasks();
        
        // 自动开始计时
        this.timer.start();
    }

    updateTaskStatus(taskId, status) {
        const taskElement = this.tasksList.querySelector(`[data-id="${taskId}"]`);
        if (taskElement) {
            // 更新任务显示状态
            taskElement.dataset.status = status;
            if (status === 'focus') {
                taskElement.classList.add('focusing');
            } else {
                taskElement.classList.remove('focusing');
            }
        }
    }

    updateTaskProgress(taskId, duration) {
        if (!this.taskProgress.has(taskId)) {
            this.taskProgress.set(taskId, {
                totalTime: 0,
                pomodoroCount: 0
            });
        }
        
        const progress = this.taskProgress.get(taskId);
        progress.totalTime += duration;
        progress.pomodoroCount++;
        
        // 更新统计数据
        statsManager.updateTaskStats(taskId, progress);
    }

    selectTask(taskId) {
        if (this.isTaskFocusing) return; // 如果有任务在专注中，禁止选择其他任务
        
        this.currentTaskId = taskId;
        this.renderTasks();
    }

    startTaskFocus(taskId) {
        this.isTaskFocusing = true;
        this.currentTaskId = taskId;
        this.renderTasks();
    }

    endTaskFocus() {
        this.isTaskFocusing = false;
        this.currentTaskId = null;
        this.renderTasks();
    }

    completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            Logger.warn('Task not found:', taskId);
            return;
        }

        Logger.log('Completing task:', task.title);

        // 1. 更新任务状态
        task.completed = true;
        task.completedAt = Date.now();
        
        // 2. 重置专注状态
        this.isTaskFocusing = false;
        this.currentTaskId = null;
        
        // 3. 记录任务统计
        statsManager.recordTaskCompletion(task);
        
        // 4. 保存并更新显示
        this.saveTasks();
        this.renderTasks();
        
        // 5. 显示完成提示
        this.showTaskCompleteNotification(task);
    }

    showTaskCompleteNotification(task) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>🎉 任务完成</h4>
                <p>${task.title}</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // 添加一个简单的提示方法
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        // 2秒后自动消失
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
    }

    switchToNextTask() {
        // 获取所有未完成的任务
        const uncompletedTasks = this.tasks.filter(task => !task.completed);
        
        if (uncompletedTasks.length === 0) {
            // 如果没有未完成的任务，显示提示
            this.showAllTasksCompleteNotification();
            return;
        }
        
        // 找到当前任务的索引
        const currentIndex = uncompletedTasks.findIndex(task => task.id === this.currentTaskId);
        
        // 获取下一个任务
        const nextTask = uncompletedTasks[currentIndex + 1] || uncompletedTasks[0];
        
        // 更新当前任务
        this.currentTaskId = nextTask.id;
        this.isTaskFocusing = false; // 重置专注状态
        
        // 更新显示
        this.renderTasks();
        
        // 显示下一个任务提示
        this.showNextTaskNotification(nextTask);
    }

    showNextTaskNotification(task) {
        const notification = document.createElement('div');
        notification.className = 'notification next-task';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>⏰ 下一个任务</h4>
                <p>${task.title}</p>
                <small>点击开始按钮开始专注</small>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 3000);
        }, 3000);
    }

    showAllTasksCompleteNotification() {
        const notification = document.createElement('div');
        notification.className = 'notification all-complete';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>🎉 太棒了！</h4>
                <p>所有任务都已完成</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 3000);
        }, 3000);
    }
}

class ConfettiEffect {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.colors = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6'];
        
        this.setupCanvas();
    }

    setupCanvas() {
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles(x, y) {
        for (let i = 0; i < 50; i++) {
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 5,
                size: Math.random() * 5 + 5,
                color,
                alpha: 1,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 2
            });
        }
    }

    animate() {
        if (this.particles.length === 0) {
            document.body.removeChild(this.canvas);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach((p, index) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2;
            p.alpha -= 0.01;
            p.rotation += p.rotationSpeed;

            if (p.alpha <= 0) {
                this.particles.splice(index, 1);
                return;
            }

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.fillStyle = `rgba(${this.hexToRgb(p.color)},${p.alpha})`;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();
        });

        requestAnimationFrame(() => this.animate());
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : 
            '46,204,113';
    }

    start(x, y) {
        document.body.appendChild(this.canvas);
        this.createParticles(x, y);
        this.animate();
    }
}

class StatsManager {
    constructor() {
        // 初始化数据结构
        this.stats = {
            daily: {},      // 每日统计
            tasks: {},      // 任务统计
            timeDistribution: {} // 时间分布
        };
        
        // 加载保存的统计数据
        this.loadStats();
        
        // 清理已删除任务的统计数据
        this.cleanDeletedTaskStats();
    }

    // 清理已删除任务的统计数据
    cleanDeletedTaskStats() {
        const existingTaskIds = taskManager.tasks.map(task => task.id);
        
        // 清理任务统计
        Object.keys(this.stats.tasks).forEach(taskId => {
            if (!existingTaskIds.includes(taskId)) {
                delete this.stats.tasks[taskId];
                Logger.log('Cleaned up stats for deleted task:', taskId);
            }
        });
        
        this.saveStats();
        this.updateOverview();
        this.updateCharts();
    }

    recordPomodoro(taskId, duration) {
        const today = new Date().toISOString().split('T')[0];
        Logger.log('Recording pomodoro:', { taskId, duration, today });

        // 检查任务是否存在
        const task = taskManager.tasks.find(t => t.id === taskId);
        if (!task) {
            Logger.warn('Attempted to record pomodoro for non-existent task:', taskId);
            return;
        }

        // 更新每日统计
        if (!this.stats.daily[today]) {
            this.stats.daily[today] = {
                pomodoroCount: 0,
                totalFocusTime: 0,
                completedTasks: 0
            };
        }
        
        this.stats.daily[today].pomodoroCount++;
        this.stats.daily[today].totalFocusTime += Math.round(duration / 60);

        // 更新任务统计
        if (!this.stats.tasks[taskId]) {
            this.stats.tasks[taskId] = {
                pomodoroCount: 0,
                totalTime: 0,
                lastUpdated: Date.now()
            };
        }
        
        this.stats.tasks[taskId].pomodoroCount++;
        this.stats.tasks[taskId].totalTime += duration;
        this.stats.tasks[taskId].lastUpdated = Date.now();

        // 更新时间分布
        const hour = new Date().getHours();
        const timeKey = `${hour.toString().padStart(2, '0')}:00`;
        if (!this.stats.timeDistribution[timeKey]) {
            this.stats.timeDistribution[timeKey] = {
                count: 0,
                totalTime: 0
            };
        }
        this.stats.timeDistribution[timeKey].count++;
        this.stats.timeDistribution[timeKey].totalTime += duration;

        this.saveStats();
        this.updateOverview();
        this.updateCharts();
    }

    getTaskData() {
        // 只获取现存任务的统计数据
        const existingTaskIds = taskManager.tasks.map(task => task.id);
        
        return Object.entries(this.stats.tasks)
            .filter(([taskId]) => existingTaskIds.includes(taskId))
            .map(([taskId, stats]) => {
                const task = taskManager.tasks.find(t => t.id === taskId);
                return {
                    title: task.title,
                    time: Math.round(stats.totalTime / 60),
                    count: stats.pomodoroCount
                };
            })
            .sort((a, b) => b.time - a.time)
            .slice(0, 5); // 只显示前5个任务
    }

    calculateCompletionRate(todayStats) {
        // 只计算现存任务的完成率
        const activeTasks = taskManager.tasks.filter(task => !task.deleted);
        const totalTasks = activeTasks.length;
        if (totalTasks === 0) return '0%';
        
        const completedTasks = activeTasks.filter(task => task.completed).length;
        const rate = Math.round((completedTasks / totalTasks) * 100);
        return `${rate}%`;
    }

    updateOverview() {
        const today = new Date().toISOString().split('T')[0];
        const todayStats = this.stats.daily[today] || {
            pomodoroCount: 0,
            totalFocusTime: 0,
            completedTasks: 0
        };

        // 更新统计卡片显示
        document.getElementById('totalPomodoros').textContent = todayStats.pomodoroCount;
        document.getElementById('totalFocusTime').textContent = this.formatTime(todayStats.totalFocusTime);
        
        // 只统计现存的已完成任务
        const completedTasksCount = taskManager.tasks.filter(task => task.completed && !task.deleted).length;
        document.getElementById('completedTasks').textContent = completedTasksCount;
        
        document.getElementById('completionRate').textContent = this.calculateCompletionRate(todayStats);
    }

    formatTime(minutes) {
        if (minutes < 60) return `${minutes}分钟`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }

    initCharts() {
        // 专注趋势图表
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '番茄钟数量',
                    data: [],
                    borderColor: this.chartTheme.colors.primary.base,
                    backgroundColor: this.chartTheme.colors.primary.light,
                    fill: true,
                    tension: 0.4
                }, {
                    label: '专注时间(小时)',
                    data: [],
                    borderColor: this.chartTheme.colors.secondary.base,
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // 任务效率分析
        this.charts.tasks = new Chart(document.getElementById('taskChart'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '专注时间(分钟)',
                    data: [],
                    backgroundColor: this.chartTheme.colors.secondary.light,
                    borderColor: this.chartTheme.colors.secondary.base,
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: this.chartTheme.colors.secondary.base
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                return `专注时间: ${value} 分钟`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // 时间分布图表
        this.charts.timeDist = new Chart(document.getElementById('timeDistChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '番茄钟数量',
                    data: [],
                    fill: true,
                    backgroundColor: this.chartTheme.colors.accent.light,
                    borderColor: this.chartTheme.colors.accent.base,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                return `完成 ${value} 个番茄钟`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    updateCharts() {
        // 1. 更新趋势图表
        const trendData = this.getTrendData();
        this.updateTrendChart(trendData);

        // 2. 更新任务效率图表
        const taskData = this.getTaskData();
        this.updateTaskChart(taskData);

        // 3. 更新时间分布图表
        const timeData = this.getTimeDistributionData();
        this.updateTimeDistChart(timeData);
    }

    getTrendData() {
        return Object.entries(this.stats.daily)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .slice(-7) // 最近7天
            .map(([date, stats]) => ({
                date: date.split('-').slice(1).join('/'),
                count: stats.pomodoroCount,
                time: Math.round(stats.totalFocusTime / 60 * 10) / 10 // 转换为小时，保留一位小数
            }));
    }

    getTimeDistributionData() {
        return Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString().padStart(2, '0');
            const timeKey = `${hour}:00`;
            return {
                hour: timeKey,
                count: (this.stats.timeDistribution[timeKey] || {}).count || 0
            };
        });
    }

    updateTrendChart(data) {
        this.charts.trend.data.labels = data.map(d => d.date);
        this.charts.trend.data.datasets[0].data = data.map(d => d.count);
        this.charts.trend.data.datasets[1].data = data.map(d => d.time);
        this.charts.trend.update();
    }

    updateTaskChart(data) {
        this.charts.tasks.data.labels = data.map(d => d.title);
        this.charts.tasks.data.datasets[0].data = data.map(d => d.time);
        this.charts.tasks.update();
    }

    updateTimeDistChart(data) {
        this.charts.timeDist.data.labels = data.map(d => d.hour);
        this.charts.timeDist.data.datasets[0].data = data.map(d => d.count);
        this.charts.timeDist.update();
    }

    updateTaskStats(taskId, progress) {
        this.taskStats.set(taskId, progress);
        this.updateCharts();
    }

    recordTaskCompletion(task) {
        const today = new Date().toISOString().split('T')[0];
        
        // 1. 更新每日统计
        if (!this.stats.daily[today]) {
            this.stats.daily[today] = {
                pomodoroCount: 0,
                totalFocusTime: 0,
                completedTasks: 0
            };
        }
        this.stats.daily[today].completedTasks++;

        // 2. 更新任务统计
        if (!this.stats.tasks[task.id]) {
            this.stats.tasks[task.id] = {
                pomodoroCount: 0,
                totalTime: 0,
                completedAt: Date.now()
            };
        }
        
        // 3. 更新时间分布
        const hour = new Date().getHours();
        const timeKey = `${hour.toString().padStart(2, '0')}:00`;
        if (!this.stats.timeDistribution[timeKey]) {
            this.stats.timeDistribution[timeKey] = {
                count: 0,
                totalTime: 0
            };
        }
        
        // 4. 保存并更新显示
        this.saveStats();
        this.updateOverview();
        this.updateCharts();
        
        // 5. 显示完成提示
        this.showCompletionNotification(task);
    }

    showCompletionNotification(task) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>🎉 任务完成</h4>
                <p>${task.title}</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

class AppState {
    constructor() {
        this.state = {
            currentTask: null,
            isFocusing: false,
            isBreakTime: false,
            stats: {
                daily: {},
                tasks: {},
                timeDistribution: {}
            }
        };
        
        // 加载保存的状态
        this.loadState();
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.saveState();
        this.notifyListeners();
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('pomodoroState');
            if (savedState) {
                this.state = JSON.parse(savedState);
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    saveState() {
        try {
            localStorage.setItem('pomodoroState', JSON.stringify(this.state));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }
}

class Logger {
    static log(message, data = {}) {
        console.log(`[Pomodoro] ${message}`, data);
    }

    static error(message, error) {
        console.error(`[Pomodoro Error] ${message}`, error);
        // 可以添加错误上报逻辑
    }

    static warn(message) {
        console.warn(`[Pomodoro Warning] ${message}`);
    }
}

class ErrorBoundary {
    static handleError(error, context) {
        Logger.error(`Error in ${context}:`, error);
        // 显示用户友好的错误提示
        this.showErrorNotification(error.message);
    }

    static showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="error-content">
                <h3>出错了</h3>
                <p>${message}</p>
                <button>知道了</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        notification.querySelector('button').onclick = () => {
            notification.remove();
        };
        
        setTimeout(() => notification.remove(), 5000);
    }
}

class ShortcutManager {
    constructor() {
        this.shortcuts = {
            'Space': () => timer.toggleTimer(),
            'KeyR': () => timer.reset(),
            'KeyN': () => taskManager.showAddTaskDialog(),
            'Escape': () => this.handleEscape()
        };
        
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            const handler = this.shortcuts[e.code];
            if (handler) {
                e.preventDefault();
                handler();
            }
        });
    }

    handleEscape() {
        // 关闭所有弹窗
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
}

// 2. 然后按正确顺序创建实例
const timer = new PomodoroTimer();
const taskManager = new TaskManager(timer);
const statsManager = new StatsManager();

// 3. 最后设置回调
timer.onComplete = () => {
    timer.completePomodoro(); // 记录番茄钟完成
    if (taskManager.currentTaskId) {
        const task = taskManager.tasks.find(t => t.id === taskManager.currentTaskId);
        if (task && !task.completed) {
            if (confirm('恭喜完成一个番茄钟！是否将当前任务标记为已完成？')) {
                taskManager.toggleTask(task.id);
            }
        }
    }
};

// 在创建实例后设置事件绑定
document.addEventListener('DOMContentLoaded', () => {
    // 任务列表点击事件委托
    document.getElementById('tasksList').addEventListener('click', (e) => {
        const target = e.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.id;
        const action = target.closest('[data-action]')?.dataset.action;

        if (action) {
            switch (action) {
                case 'focus':
                    taskManager.focusTask(taskId);
                    break;
                case 'delete':
                    taskManager.deleteTask(taskId);
                    break;
            }
        }
    });
}); 