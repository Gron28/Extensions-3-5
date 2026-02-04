# Activation Suite

A collection of minimalist productivity tools designed to track physical activation and deep work cycles. 

This suite ensures you stay active and focused throughout the day. It was originally built as **GNOME Shell extensions** for Linux and has been fully implemented for **Windows** as a lightweight, standalone system tray application.

## Philosophy & Background

This project emerged from a personal experiment to find my optimal daily rhythm. I struggled to differentiate between "work mode" and leisure, often leading to distractions or burnout. I found that dividing the day into **3-hour deep work blocks** was an intuitive solution, long enough for meaningful progress, but less intimidating to begin than thinking of the whole workday at once.

To make this stick, I needed a persistent visual cue. The "Work Cycles" tool provides a constant, non-intrusive reminder on screen, signaling the subconscious that a session is active. It is also persistently present in the taskbar, ready to run even after a computer restart.

Similarly, "Body Activation" brings structure to physical health. It runs a timer for **5 rounds of movement** (approx. 10-15 mins). This isn't necessarily a heavy workout, but a nervous system reset to boost concentration for the next work block.

**Design Philosophy:**
I intentionally avoided gamification or dopaministic design. The interface is strictly informational, using simple grids and skylines to track completion. The goal is to reflect what I hypothesize to be the essence of work—its archetype.

**Recommended Routine:**
1. **Work Cycle** (3 hours)
2. **Body Activation** (10-15 mins)
3. **Rest** (30-60 mins)

*Repeat 2 or 3 times daily.*

## Structure

### /gnome
Contains two GNOME Shell extensions (tested on GNOME 46) featuring custom icons and integration with the top bar:
- **Body Activation**: A 10-minute, 5-round timer for physical movement.
- **Work Cycles**: A 3-hour timer for deep work sessions.

**Installation (Linux):**
1. Copy the folders `body-activation` and `work-cycles` to `~/.local/share/gnome-shell/extensions/`.
2. Restart GNOME Shell (Log out/in or `Alt+F2`, then `r`).
3. Enable via **Extensions** app.

### /windows
A complete port of both tools into a single desktop application. It runs in the system tray, uses native notifications, and provides a non-intrusive screen overlay for tracking progress.

**Development & Build:**
1. Navigate to the `/windows` directory.
2. Install dependencies: `npm install`.
3. Run in dev mode: `npm start`.
4. Build portable executable: `npm run build`.

## Features
- **Unified Design**: Consistent visual identity across platforms with custom iconography.
- **Minimalist UI**: Simple data visualizations (Month Grid and Weekly Skyline) to track consistency without clutter.
- **Progress Overlays**: Thin, non-intrusive progress bars at the top of the screen to keep you aware of your current cycle.
- **Local Data**: All history is stored locally in JSON format (no cloud dependencies).

## License
MIT
