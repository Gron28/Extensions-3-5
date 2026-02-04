# Activation Suite

A minimalist tracker for Body Activation routines and Work Cycles.

## Platforms

- **GNOME** - Native GNOME Shell extensions (Linux)
- **Windows** - Electron-based tray application

## Installation

### GNOME (Linux)

Copy the extension folders to `~/.local/share/gnome-shell/extensions/`:

```bash
cp -r gnome/body-activation ~/.local/share/gnome-shell/extensions/body-activation@gron
cp -r gnome/work-cycles ~/.local/share/gnome-shell/extensions/work-cycles@gron
```

Then restart GNOME Shell (`Alt+F2`, type `r`, press Enter) and enable via Extensions app.

### Windows

#### Option 1: Run from source
```bash
cd windows
npm install
npm start
```

#### Option 2: Build executable
```bash
cd windows
npm install
npm run build
```

The portable `.exe` will be in `windows/dist/`.

#### Auto-start on Windows boot
1. Press `Win + R`, type `shell:startup`
2. Create a shortcut to the `.exe` in that folder

## Features

- **Body Activation**: 10-minute timer with 5 rounds, segmented progress bar
- **Work Cycles**: 3-hour deep work timer, solid progress bar
- **Calendar view**: Track completion history with GitHub-style heatmap
- **Skyline view**: Weekly activity visualization

## RAM Usage

- GNOME: ~5-10 MB (native)
- Windows: ~100-150 MB (Electron)

## License

MIT
