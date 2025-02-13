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

// 创建计时器实例
const timer = new PomodoroTimer(); 