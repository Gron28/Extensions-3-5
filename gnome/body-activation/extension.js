import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// --- CONFIGURATION ---
const DEV_MODE = false; 
let CYCLE_DURATION_MS = 10 * 60 * 1000; 

const MartialBodyButton = GObject.registerClass(
    class MartialBodyButton extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, 'BodyActivation');

            this._extension = extension;
            this._dataParams = { startTime: null, history: [] };
            this._timerId = null;

            // Navigation State
            this._viewDate = new Date();
            this._waitingConfirmation = false;

            // --- ICON ---
            let iconBox = new St.BoxLayout({ style_class: 'martial-icon-box' });
            let iconPath = this._extension.path + '/icon.png';
            let gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) });

            this._iconLabel = new St.Icon({
                gicon: gicon,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'martial-icon',
                icon_size: 16
            });

            iconBox.add_child(this._iconLabel);
            this.add_child(iconBox);

            // --- MENU CONTAINER ---
            this._contentBox = new St.BoxLayout({
                vertical: true,
                style_class: 'martial-tracker-card'
            });
            this.menu.box.add_child(this._contentBox);

            // 1. Header (Nav)
            this._headerBox = new St.BoxLayout({
                style_class: 'martial-header',
                x_align: Clutter.ActorAlign.CENTER,
                pack_start: true
            });

            this._prevBtn = new St.Button({ label: '‹', style_class: 'martial-nav-arrow' });
            this._prevBtn.connect('clicked', () => this._navMonth(-1));

            this._nextBtn = new St.Button({ label: '›', style_class: 'martial-nav-arrow' });
            this._nextBtn.connect('clicked', () => this._navMonth(1));

            this._monthLabel = new St.Label({ text: '...', style_class: 'martial-month-name', y_align: Clutter.ActorAlign.CENTER });

            this._headerBox.add_child(this._prevBtn);
            this._headerBox.add_child(this._monthLabel);
            this._headerBox.add_child(this._nextBtn);

            this._contentBox.add_child(this._headerBox);

            // 2. Start Button
            this._startButton = new St.Button({
                style_class: 'martial-start-btn',
                label: 'Start Activation',
                can_focus: true,
                style: 'margin-bottom: 0px;'
            });
            this._startButton.connect('clicked', () => {
                this._startCycle();
                this.menu.close();
            });
            this._contentBox.add_child(this._startButton);

            // 2b. Routine Display
            this._routineBox = new St.BoxLayout({
                vertical: true,
                visible: false,
                style: 'margin: 10px 0;',
                x_align: Clutter.ActorAlign.CENTER
            });
            this._roundLabel = new St.Label({
                text: '1/5',
                style: 'color: #ff4d6d; font-weight: bold; font-size: 18px; text-align: center;'
            });
            
            this._routineBox.add_child(this._roundLabel);
            this._contentBox.add_child(this._routineBox);

            // 2c. Confirmation Box
            this._confirmBox = new St.BoxLayout({
                style_class: 'martial-confirm-box',
                visible: false,
                x_align: Clutter.ActorAlign.CENTER
            });
            
            let yesBtn = new St.Button({ label: 'Complete', style_class: 'martial-confirm-btn btn-yes' });
            yesBtn.connect('clicked', () => this._confirmCompletion(true));
            
            let noBtn = new St.Button({ label: 'Discard', style_class: 'martial-confirm-btn btn-no' });
            noBtn.connect('clicked', () => this._confirmCompletion(false));

            this._confirmBox.add_child(yesBtn);
            this._confirmBox.add_child(noBtn);
            this._contentBox.add_child(this._confirmBox);

            // 3. Vis Stack container
            this._visStack = new St.BoxLayout({
                vertical: true,
                style_class: 'martial-vis-stack'
            });
            this._contentBox.add_child(this._visStack);

            // 3a. Week Row (Skyline)
            this._weekRow = new St.BoxLayout({ style_class: 'martial-week-row', x_align: Clutter.ActorAlign.CENTER });
            this._visStack.add_child(this._weekRow);

            // 3b. Labels Row (M T W...)
            this._labelsRow = new St.BoxLayout({ style_class: 'martial-labels-row', x_align: Clutter.ActorAlign.CENTER });
            ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(day => {
                this._labelsRow.add_child(new St.Label({ text: day, style_class: 'martial-lbl' }));
            });
            this._visStack.add_child(this._labelsRow);

            // 3c. Month Grid
            this._monthGrid = new St.BoxLayout({ vertical: true, style_class: 'martial-month-grid', x_align: Clutter.ActorAlign.CENTER });
            this._visStack.add_child(this._monthGrid);

            // --- DEV TOOLS ---
            if (DEV_MODE) {
                this._devBox = new St.BoxLayout({
                    vertical: true,
                    style: 'margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;'
                });
                
                let devLabel = new St.Label({ text: 'DEV MODE', style: 'color: #555; font-size: 10px; font-weight: bold; margin-bottom: 5px;' });
                this._devBox.add_child(devLabel);

                let btnRow1 = new St.BoxLayout({});
                let btnRow2 = new St.BoxLayout({});
                this._devBox.add_child(btnRow1);
                this._devBox.add_child(btnRow2);

                let fillBtn = new St.Button({
                    label: 'Fill Data',
                    style_class: 'martial-nav-arrow',
                    style: 'background-color: #222; border: 1px solid #444; border-radius: 4px; padding: 4px; font-size: 10px;'
                });
                fillBtn.connect('clicked', () => this._devFillData());
                btnRow1.add_child(fillBtn);

                let resetBtn = new St.Button({
                    label: 'Reset',
                    style_class: 'martial-nav-arrow',
                    style: 'background-color: #222; border: 1px solid #444; border-radius: 4px; padding: 4px; font-size: 10px;'
                });
                resetBtn.connect('clicked', () => this._devResetData());
                btnRow1.add_child(resetBtn);

                let skipBtn = new St.Button({
                    label: 'Skip/Finish',
                    style_class: 'martial-nav-arrow',
                    style: 'background-color: #222; border: 1px solid #444; border-radius: 4px; padding: 4px; font-size: 10px;'
                });
                skipBtn.connect('clicked', () => this._devSkip());
                btnRow2.add_child(skipBtn);

                this._contentBox.add_child(this._devBox);
            }

            // --- PROGRESS BAR (SEGMENTED) ---
            this._progressContainer = new St.BoxLayout({
                style_class: 'martial-progress-container',
                visible: false,
                reactive: false
            });
            this._progressSegments = [];
            for(let i=0; i<5; i++) {
                let segmentTrack = new St.BoxLayout({
                    style_class: 'martial-progress-segment',
                    x_expand: true,
                    y_expand: true
                });
                let segmentFill = new St.Widget({
                    style_class: 'martial-progress-fill',
                    width: 0,
                    x_expand: false,
                    y_expand: true
                });
                segmentTrack.add_child(segmentFill);
                this._progressContainer.add_child(segmentTrack);
                this._progressSegments.push({ track: segmentTrack, fill: segmentFill });
            }
            Main.uiGroup.add_child(this._progressContainer);

            // --- LOGIC ---
            this._loadData();
            // Removed watcher logic as we removed the glow sync for simplicity/minimalism

            if (this._isActive()) {
                this._dataParams.startTime = null;
                this._saveData();
            }

            this._updateView();
        }

        _devFillData() {
            let m = this._viewDate.getMonth();
            let y = this._viewDate.getFullYear();
            let daysInMonth = new Date(y, m + 1, 0).getDate();
            this._dataParams.history = []; 
            for (let d = 1; d <= daysInMonth; d++) {
                let count = Math.floor(Math.random() * 6);
                let dayDate = new Date(y, m, d, 12, 0, 0);
                for (let c = 0; c < count; c++) {
                    this._dataParams.history.push(dayDate.getTime() + (c * 3600000));
                }
            }
            this._saveData();
            this._updateView();
        }

        _devResetData() {
            this._dataParams = { startTime: null, history: [] };
            this._saveData();
            this._updateView();
        }

        _devSkip() {
            if (!this._isActive()) this._startCycle();
            this._dataParams.startTime = Date.now() - CYCLE_DURATION_MS + 5000;
            this._saveData();
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

            if (this._waitingConfirmation) {
                this._startButton.visible = false;
                this._confirmBox.visible = true;
                this._routineBox.visible = false;
            } else if (this._isActive()) {
                this._startButton.visible = false;
                this._confirmBox.visible = false;
                this._routineBox.visible = true;
                this._updateRoutineLabels();
            } else {
                this._confirmBox.visible = false;
                this._routineBox.visible = false;
                this._startButton.visible = true;
            }

            this._monthGrid.destroy_all_children();
            let daysInMonth = new Date(y, m + 1, 0).getDate();
            let firstDayObj = new Date(y, m, 1);
            let startDay = firstDayObj.getDay(); 
            let gridStartCol = (startDay + 6) % 7;
            let gridCells = []; 
            for (let i = 0; i < gridStartCol; i++) gridCells.push(null);

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

            while (gridCells.length % 7 !== 0) gridCells.push(null);

            for (let i = 0; i < gridCells.length; i += 7) {
                let row = new St.BoxLayout({ style_class: 'martial-month-row' });
                for (let c = 0; c < 7; c++) {
                    let cellData = gridCells[i + c];
                    let cell = new St.Button({ style_class: 'martial-day-cell', reactive: true, can_focus: true });
                    if (cellData) {
                        cell.connect('clicked', () => this._toggleDayCycle(cellData.year, cellData.month, cellData.day));
                        if (cellData.count > 0) {
                            let intensity = Math.min(cellData.count, 4);
                            cell.add_style_class_name('martial-level-' + intensity);
                        } else {
                            cell.add_style_class_name('martial-level-0');
                        }
                        if (cellData.isToday) cell.add_style_class_name('martial-day-today');
                    } else {
                        cell.add_style_class_name('martial-day-empty');
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
                    style_class: 'martial-week-col',
                    y_align: Clutter.ActorAlign.END
                });
                for (let k = 0; k < count; k++) {
                    if (k >= 4) break; 
                    let block = new St.Widget({ style_class: 'martial-block' });
                    if (k === 3 || k === count - 1) block.add_style_class_name('martial-block-active');
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
            // Glow logic removed
            this._dataParams.startTime = Date.now();
            this._saveData();
            this._updateView();
            this._startTimer();
        }

        _startTimer() {
            if (this._timerId) GLib.source_remove(this._timerId);
            this._updateProgress();
            this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => this._updateProgress());
        }

        _updateProgress() {
            if (!this._isActive()) {
                this._progressContainer.visible = false;
                return GLib.SOURCE_REMOVE;
            }
            let elapsed = Date.now() - this._dataParams.startTime;
            this._updateRoutineLabels();
            if (elapsed >= CYCLE_DURATION_MS) {
                this._onCycleTimerEnd();
                return GLib.SOURCE_REMOVE;
            }
            let monitor = Main.layoutManager.primaryMonitor;
            this._progressContainer.width = monitor.width;
            this._progressContainer.x = monitor.x;
            this._progressContainer.y = Main.panel.height;
            this._progressContainer.visible = true;
            Main.uiGroup.set_child_above_sibling(this._progressContainer, null);
            let segmentDuration = CYCLE_DURATION_MS / 5;
            let currentSegment = Math.floor(elapsed / segmentDuration);
            let segmentProgress = (elapsed % segmentDuration) / segmentDuration;
            let segmentWidth = (monitor.width - 10) / 5; 
            for (let i = 0; i < 5; i++) {
                let seg = this._progressSegments[i];
                if (i < currentSegment) seg.fill.width = segmentWidth; 
                else if (i === currentSegment) seg.fill.width = segmentWidth * segmentProgress;
                else seg.fill.width = 0;
            }
            return GLib.SOURCE_CONTINUE;
        }

        _updateRoutineLabels() {
            if (!this._isActive()) return;
            let elapsed = Date.now() - this._dataParams.startTime;
            let round = Math.floor(elapsed / (CYCLE_DURATION_MS / 5)) + 1;
            round = Math.min(round, 5);
            this._roundLabel.text = `${round}/5`;
        }

        _onCycleTimerEnd() {
            this._progressContainer.visible = false;
            this._timerId = null;
            this._waitingConfirmation = true;
            this._dataParams.startTime = null; 
            this._updateView();
            this.menu.open(true);
        }

        _confirmCompletion(isCompleted) {
            if (isCompleted) {
                if (!this._dataParams.history) this._dataParams.history = [];
                this._dataParams.history.push(Date.now());
                this._saveData();
            } else {
                this._saveData();
            }
            this._waitingConfirmation = false;
            this.menu.close();
            this._updateView();
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
            // No glow timer to remove
            if (this._otherFileMonitor) this._otherFileMonitor.cancel();
            if (this._progressContainer) this._progressContainer.destroy();
            super.destroy();
        }
    });

export default class BodyActivationExtension extends Extension {
    enable() {
        this._indicator = new MartialBodyButton(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
