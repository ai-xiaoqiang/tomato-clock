class StatsPage {
    constructor() {
        this.loadData();
        this.initCharts();
        this.bindEvents();
        this.updateStats();
    }

    loadData() {
        try {
            this.stats = JSON.parse(localStorage.getItem('pomodoroStats')) || {
                daily: {},
                tasks: {},
                timeDistribution: {}
            };
        } catch (error) {
            console.error('Error loading stats:', error);
            this.stats = {
                daily: {},
                tasks: {},
                timeDistribution: {}
            };
        }
    }

    // ... 其他方法保持不变，从 StatsManager 类迁移过来 ...
}

// 创建统计页面实例
const statsPage = new StatsPage(); 