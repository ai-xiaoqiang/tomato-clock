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
            btn.addEventListener('click', () => this.setPresetTime(parseInt(btn.dataset.time)));
        });

        // 自定义时间
        document.getElementById('setCustomTime').addEventListener('click', () => {
            const input = document.getElementById('customTime');
            const time = parseInt(input.value);
            if (time && time > 0 && time <= 120) {
                this.setPresetTime(time);
                input.value = '';
            } else {
                alert('请输入1-120之间的数字');
            }
        });

        // 初始化显示
        this.updateDisplay();

        // 添加任务完成回调
        this.onComplete = null;
    }

    setPresetTime(minutes) {
        if (this.isRunning) {
            this.pause();
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
        
        this.timerId = setInterval(() => {
            this.timeLeft--;
            
            if (this.timeLeft <= 0) {
                this.alertSound.play();
                this.isWorkTime = !this.isWorkTime;
                this.timeLeft = this.isWorkTime ? this.workTime : this.breakTime;
                this.totalTime = this.timeLeft;
                this.updateDisplay();
                this.updateTheme();
                this.pause();

                // 工作时间结束时触发回调
                if (!this.isWorkTime && this.onComplete) {
                    this.onComplete();
                }
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
        this.updateDisplay();
        this.updateProgressRing();
        this.updateTheme();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.statusDisplay.textContent = this.isWorkTime ? '工作时间' : '休息时间';
    }

    updateProgressRing() {
        const circumference = 2 * Math.PI * 140;
        const progress = this.timeLeft / this.totalTime;
        const offset = circumference * (1 - progress);
        this.progressRing.style.strokeDashoffset = offset;
    }

    updateTheme() {
        document.body.classList.toggle('work-mode', this.isWorkTime);
        document.body.classList.toggle('break-mode', !this.isWorkTime);
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
        this.tasks.sort((a, b) => a.order - b.order).forEach(task => {
            const taskElement = this.createTaskElement(task);
            this.tasksList.appendChild(taskElement);
        });
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
        if (!confirm('确定要删除这个任务吗？')) return;
        
        // 如果删除的是当前专注的任务，重置计时器
        if (taskId === this.currentTaskId) {
            this.currentTaskId = null;
            this.timer.reset();
        }
        
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        this.saveTasks();
        this.renderTasks();
    }

    toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.completed = !task.completed;
        
        if (task.completed) {
            // 获取任务元素的位置来触发礼花效果
            const taskElement = this.tasksList.querySelector(`[data-id="${taskId}"]`);
            const rect = taskElement.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            this.confetti.start(x, y);
            
            // 如果是当前专注的任务，重置计时器
            if (taskId === this.currentTaskId) {
                this.currentTaskId = null;
                this.timer.reset();
            }
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

// 2. 然后按正确顺序创建实例
const timer = new PomodoroTimer();
const taskManager = new TaskManager(timer);

// 3. 最后设置回调
timer.onComplete = () => {
    if (taskManager.currentTaskId) {
        const task = taskManager.tasks.find(t => t.id === taskManager.currentTaskId);
        if (task && !task.completed) {
            if (confirm('恭喜完成一个番茄钟！是否将当前任务标记为已完成？')) {
                taskManager.toggleTask(task.id);
            }
        }
    }
}; 