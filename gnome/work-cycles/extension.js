import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// --- CONFIGURATION ---
const CYCLE_DURATION_MS = 3 * 60 * 60 * 1000;

const CycleButton = GObject.registerClass(
    class CycleButton extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, 'WorkCycles');

            this._extension = extension;
            this._dataParams = { startTime: null, history: [] };
            this._timerId = null;

            // Navigation State
            this._viewDate = new Date();

            // --- ICON ---
            let iconBox = new St.BoxLayout({ style_class: 'cycle-icon-box' });
            
            let iconPath = this._extension.path + '/icon.png';
            let gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) });
            
            this._iconLabel = new St.Icon({
                gicon: gicon,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'cycle-icon',
                icon_size: 16
            });
            // Removed inline style to use CSS class for minimalism
            // this._iconLabel.style = ... (removed)

            iconBox.add_child(this._iconLabel);
            this.add_child(iconBox);

            // --- MENU CONTAINER ---
            this._contentBox = new St.BoxLayout({
                vertical: true,
                style_class: 'cycle-tracker-card'
            });
            this.menu.box.add_child(this._contentBox);

            // 1. Header (Nav)
            this._headerBox = new St.BoxLayout({
                style_class: 'cycle-header',
                x_align: Clutter.ActorAlign.CENTER,
                pack_start: true
            });

            this._prevBtn = new St.Button({ label: '‹', style_class: 'cycle-nav-arrow' });
            this._prevBtn.connect('clicked', () => this._navMonth(-1));

            this._nextBtn = new St.Button({ label: '›', style_class: 'cycle-nav-arrow' });
            this._nextBtn.connect('clicked', () => this._navMonth(1));

            this._monthLabel = new St.Label({ text: '...', style_class: 'cycle-month-name', y_align: Clutter.ActorAlign.CENTER });

            this._headerBox.add_child(this._prevBtn);
            this._headerBox.add_child(this._monthLabel);
            this._headerBox.add_child(this._nextBtn);

            this._contentBox.add_child(this._headerBox);

            // 2. Start Button
            this._startButton = new St.Button({
                style_class: 'cycle-start-btn',
                label: 'Start Cycle',
                can_focus: true,
                style: 'margin-bottom: 0px;'
            });
            this._startButton.connect('clicked', () => {
                this._startCycle();
                this.menu.close();
            });
            this._contentBox.add_child(this._startButton);

            // 3. Vis Stack container
            this._visStack = new St.BoxLayout({
                vertical: true,
                style_class: 'cycle-vis-stack'
            });
            this._contentBox.add_child(this._visStack);

            // 3a. Week Row (Skyline)
            this._weekRow = new St.BoxLayout({ style_class: 'cycle-week-row', x_align: Clutter.ActorAlign.CENTER });
            this._visStack.add_child(this._weekRow);

            // 3b. Labels Row (M T W...)
            this._labelsRow = new St.BoxLayout({ style_class: 'cycle-labels-row', x_align: Clutter.ActorAlign.CENTER });
            ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(day => {
                this._labelsRow.add_child(new St.Label({ text: day, style_class: 'cycle-lbl' }));
            });
            this._visStack.add_child(this._labelsRow);

            // 3c. Month Grid
            this._monthGrid = new St.BoxLayout({ vertical: true, style_class: 'cycle-month-grid', x_align: Clutter.ActorAlign.CENTER });
            this._visStack.add_child(this._monthGrid);

            // --- PROGRESS BAR ---
            this._progressBar = new St.Widget({
                style_class: 'cycle-progress-bar',
                visible: false,
                reactive: false
            });
            Main.uiGroup.add_child(this._progressBar);

            // --- LOGIC ---
            this._loadData();

            // Reset active on load
            if (this._isActive()) {
                this._dataParams.startTime = null;
                this._saveData();
            }

            this._updateView();
        }

        _navMonth(delta) {
            let newDate = new Date(this._viewDate);
            newDate.setMonth(newDate.getMonth() + delta);
            this._viewDate = newDate;
            this._updateView();
        }

        _updateView() {
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            let m = this._viewDate.getMonth();
            let y = this._viewDate.getFullYear();
            this._monthLabel.text = `${monthNames[m]} ${y}`;

            this._startButton.visible = !this._isActive();

            this._monthGrid.destroy_all_children();

            let daysInMonth = new Date(y, m + 1, 0).getDate();
            let firstDayObj = new Date(y, m, 1);
            let startDay = firstDayObj.getDay(); 
            let gridStartCol = (startDay + 6) % 7;

            let gridCells = [];

            for (let i = 0; i < gridStartCol; i++) {
                gridCells.push(null);
            }

            let now = new Date();
            let isCurrentMonth = (now.getMonth() === m && now.getFullYear() === y);
            let todayDate = now.getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                let count = this._getCyclesForDate(y, m, d);
                gridCells.push({
                    count: count,
                    isToday: (isCurrentMonth && d === todayDate),
                    isValid: true,
                    day: d,
                    month: m,
                    year: y
                });
            }

            while (gridCells.length % 7 !== 0) {
                gridCells.push(null);
            }

            for (let i = 0; i < gridCells.length; i += 7) {
                let row = new St.BoxLayout({ style_class: 'cycle-month-row' });
                for (let c = 0; c < 7; c++) {
                    let cellData = gridCells[i + c];
                    let cell = new St.Button({ style_class: 'cycle-day-cell', reactive: true, can_focus: true });

                    if (cellData) {
                        cell.connect('clicked', () => this._toggleDayCycle(cellData.year, cellData.month, cellData.day));

                        if (cellData.count > 0) {
                            let intensity = Math.min(cellData.count, 4);
                            cell.add_style_class_name('cycle-level-' + intensity);
                        } else {
                            cell.add_style_class_name('cycle-level-0');
                        }

                        if (cellData.isToday) {
                            cell.add_style_class_name('cycle-day-today');
                        }
                    } else {
                        cell.add_style_class_name('cycle-day-empty');
                    }
                    row.add_child(cell);
                }
                this._monthGrid.add_child(row);
            }

            this._weekRow.destroy_all_children();
            let anchorDate = isCurrentMonth ? now : new Date(y, m + 1, 0);
            let dayOfWeek = anchorDate.getDay();
            let distToMon = (dayOfWeek + 6) % 7;
            let mondayDate = new Date(anchorDate);
            mondayDate.setDate(anchorDate.getDate() - distToMon);

            let skylineData = [];
            for (let i = 0; i < 7; i++) {
                let d = new Date(mondayDate);
                d.setDate(mondayDate.getDate() + i);
                let c = this._getCyclesForDate(d.getFullYear(), d.getMonth(), d.getDate());
                skylineData.push(c);
            }

            skylineData.forEach(count => {
                let col = new St.BoxLayout({
                    vertical: true,
                    style_class: 'cycle-week-col',
                    y_align: Clutter.ActorAlign.END
                });

                for (let k = 0; k < count; k++) {
                    if (k >= 4) break;
                    let block = new St.Widget({ style_class: 'cycle-block' });
                    if (k === 3 || k === count - 1) {
                        block.add_style_class_name('cycle-block-active');
                    }
                    col.add_child(block);
                }
                this._weekRow.add_child(col);
            });
        }

        _toggleDayCycle(year, month, day) {
            let currentCount = this._getCyclesForDate(year, month, day);
            if (currentCount >= 4) {
                this._dataParams.history = this._dataParams.history.filter(ts => {
                    let d = new Date(ts);
                    return !(d.getFullYear() === year && d.getMonth() === month && d.getDate() === day);
                });
            } else {
                let newDate = new Date(year, month, day, 12, 0, 0);
                this._dataParams.history.push(newDate.getTime());
            }
            this._saveData();
            this._updateView();
        }

        _getCyclesForDate(year, month, day) {
            if (!this._dataParams.history) return 0;
            let count = 0;
            this._dataParams.history.forEach(ts => {
                let date = new Date(ts);
                if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                    count++;
                }
            });
            return count;
        }

        _isActive() { return (this._dataParams && this._dataParams.startTime !== null); }

        _startCycle() {
            this._dataParams.startTime = Date.now();
            this._saveData();
            this._updateView();
            this._startTimer();
        }

        _startTimer() {
            if (this._timerId) GLib.source_remove(this._timerId);
            this._updateProgress();
            this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => this._updateProgress());
        }

        _updateProgress() {
            if (!this._isActive()) {
                this._progressBar.visible = false;
                return GLib.SOURCE_REMOVE;
            }
            let elapsed = Date.now() - this._dataParams.startTime;
            if (elapsed >= CYCLE_DURATION_MS) {
                this._finishCycle();
                return GLib.SOURCE_REMOVE;
            }

            let monitor = Main.layoutManager.primaryMonitor;
            let decimal = elapsed / CYCLE_DURATION_MS;
            this._progressBar.width = monitor.width * decimal;
            this._progressBar.height = 6;
            this._progressBar.x = monitor.x;
            this._progressBar.y = Main.panel.height;
            this._progressBar.visible = true;
            Main.uiGroup.set_child_above_sibling(this._progressBar, null);
            return GLib.SOURCE_CONTINUE;
        }

        _finishCycle() {
            if (!this._dataParams.history) this._dataParams.history = [];
            this._dataParams.history.push(Date.now());
            this._dataParams.startTime = null;
            this._saveData();
            this._progressBar.visible = false;
            this._updateView();
            this._timerId = null;
        }

        _loadData() {
            try {
                let path = this._extension.path + '/data.json';
                let file = Gio.File.new_for_path(path);
                if (file.query_exists(null)) {
                    let [success, contents] = file.load_contents(null);
                    if (success) {
                        let decoder = new TextDecoder('utf-8');
                        this._dataParams = JSON.parse(decoder.decode(contents));
                    }
                }
            } catch (e) {
                this._dataParams = { startTime: null, history: [] };
            }
        }

        _saveData() {
            try {
                let path = this._extension.path + '/data.json';
                let file = Gio.File.new_for_path(path);
                file.replace_contents(JSON.stringify(this._dataParams), null, false, Gio.FileCreateFlags.NONE, null);
            } catch (e) { }
        }

        destroy() {
            if (this._timerId) GLib.source_remove(this._timerId);
            if (this._progressBar) this._progressBar.destroy();
            super.destroy();
        }
    });

export default class WorkCyclesExtension extends Extension {
    enable() {
        this._indicator = new CycleButton(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}