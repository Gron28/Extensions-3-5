const { ipcRenderer } = require('electron');

let currentType = 'body'; // 'body' or 'work'
let data = {
    body: { startTime: null, history: [] },
    work: { startTime: null, history: [] }
};
let viewDate = new Date();

const CONFIG = {
    body: { duration: 10 * 60 * 1000, label: 'Start Activation', rounds: 5, color: '#ff4d6d' },
    work: { duration: 3 * 60 * 60 * 1000, label: 'Start Cycle', rounds: 1, color: '#4d9eff' }
};

async function init() {
    data.body = await ipcRenderer.invoke('get-data', 'body');
    data.work = await ipcRenderer.invoke('get-data', 'work');
    updateView();
    
    // Check for cycle completion every second (progress bar handled by main process)
    setInterval(() => {
        ['body', 'work'].forEach(type => {
            const d = data[type];
            if (d.startTime) {
                const elapsed = Date.now() - d.startTime;
                
                if (type === currentType) updateRoutineLabels();
                
                if (elapsed >= CONFIG[type].duration) {
                    onCycleEnd(type);
                }
            }
        });
    }, 1000);
}

ipcRenderer.on('set-type', (e, type) => {
    currentType = type;
    updateView();
});

function updateView() {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const m = viewDate.getMonth();
    const y = viewDate.getFullYear();
    document.getElementById('monthLabel').innerText = `${monthNames[m]} ${y}`;

    const config = CONFIG[currentType];
    const d = data[currentType];
    const isRunning = d.startTime !== null;

    const startBtn = document.getElementById('startBtn');
    startBtn.innerText = config.label;
    startBtn.style.display = isRunning ? 'none' : 'block';
    
    document.getElementById('routineBox').style.display = (isRunning && config.rounds > 1) ? 'block' : 'none';
    document.getElementById('confirmBox').style.display = 'none';
    
    document.getElementById('roundLabel').style.color = config.color;

    renderMonthGrid(y, m);
    renderSkyline(y, m);
}

function renderMonthGrid(y, m) {
    const grid = document.getElementById('monthGrid');
    grid.innerHTML = '';
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
    let cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    const now = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({
            day: d,
            isToday: (now.getMonth() === m && now.getFullYear() === y && d === now.getDate()),
            count: getCycles(currentType, y, m, d)
        });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    for (let i = 0; i < cells.length; i += 7) {
        const row = document.createElement('div');
        row.className = 'martial-month-row';
        for (let c = 0; c < 7; c++) {
            const cellData = cells[i + c];
            const cell = document.createElement('div');
            cell.className = 'martial-day-cell';
            if (cellData) {
                cell.classList.add(`martial-level-${Math.min(cellData.count, 4)}`);
                if (cellData.isToday) cell.classList.add('martial-day-today');
                cell.onclick = () => toggleCycle(currentType, y, m, cellData.day);
            } else {
                cell.classList.add('martial-day-empty');
            }
            row.appendChild(cell);
        }
        grid.appendChild(row);
    }
}

function renderSkyline(y, m) {
    const weekRow = document.getElementById('weekRow');
    weekRow.innerHTML = '';
    const now = new Date();
    const anchor = (now.getMonth() === m && now.getFullYear() === y) ? now : new Date(y, m + 1, 0);
    const dist = (anchor.getDay() + 6) % 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - dist);

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const count = getCycles(currentType, d.getFullYear(), d.getMonth(), d.getDate());
        const col = document.createElement('div');
        col.className = 'martial-week-col';
        for (let k = 0; k < Math.min(count, 4); k++) {
            const b = document.createElement('div');
            b.className = 'martial-block';
            if (k === 3 || k === count - 1) b.classList.add('martial-block-active');
            col.appendChild(b);
        }
        weekRow.appendChild(col);
    }
}

function getCycles(type, y, m, d) {
    return data[type].history.filter(ts => {
        const dt = new Date(ts);
        return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
}

function toggleCycle(type, y, m, d) {
    const current = getCycles(type, y, m, d);
    if (current >= 4) {
        data[type].history = data[type].history.filter(ts => {
            const dt = new Date(ts);
            return !(dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d);
        });
    } else {
        data[type].history.push(new Date(y, m, d, 12, 0, 0).getTime());
    }
    ipcRenderer.send('save-data', type, data[type]);
    updateView();
}

function updateRoutineLabels() {
    const d = data[currentType];
    const config = CONFIG[currentType];
    if (!d.startTime || config.rounds <= 1) return;
    const elapsed = Date.now() - d.startTime;
    let round = Math.floor(elapsed / (config.duration / config.rounds)) + 1;
    document.getElementById('roundLabel').innerText = `${Math.min(round, config.rounds)}/${config.rounds}`;
}

function onCycleEnd(type) {
    ipcRenderer.send('update-progress', type, 0);
    if (type === 'work') {
        data.work.history.push(Date.now());
        data.work.startTime = null;
        ipcRenderer.send('save-data', 'work', data.work);
        if (currentType === 'work') updateView();
    } else {
        if (currentType === 'body') {
            document.getElementById('routineBox').style.display = 'none';
            document.getElementById('confirmBox').style.display = 'flex';
        }
    }
}

document.getElementById('startBtn').onclick = () => {
    data[currentType].startTime = Date.now();
    ipcRenderer.send('save-data', currentType, data[currentType]);
    updateView();
};

document.getElementById('yesBtn').onclick = () => {
    data.body.history.push(Date.now());
    data.body.startTime = null;
    ipcRenderer.send('save-data', 'body', data.body);
    updateView();
};

document.getElementById('noBtn').onclick = () => {
    data.body.startTime = null;
    ipcRenderer.send('save-data', 'body', data.body);
    updateView();
};

document.getElementById('prevBtn').onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); updateView(); };
document.getElementById('nextBtn').onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); updateView(); };

// Close button
document.getElementById('closeBtn').onclick = () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('close-menu');
};

init();