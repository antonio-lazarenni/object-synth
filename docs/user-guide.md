# Object Synth User Guide

This guide is for performers, artists, and workshop participants who want to use Object Synth without reading code.

Object Synth turns camera movement into sound. You place zones on the video, assign sounds to those zones, and then trigger audio by moving objects or people through the zones.

## Before You Start

- Use a laptop/desktop with a webcam (built-in or external).
- Use a modern Chromium-based browser for best support.
- Allow camera access when prompted.
- Prepare a folder of audio files (`.wav`, `.mp3`, etc.) for faster setup.

## Quick Start (First Successful Session)

1. Open the app and allow camera permission.
2. In `Control Dashboard`, keep mode set to `Edit`.
3. In `Active Areas`:
   - Choose your `Webcam`.
   - Keep `Process resolution` at a mid or low option to start.
4. In `Zones Management`, set `Active zones` to `1` or `2`.
5. Drag a zone box on the canvas to place it where movement should trigger sound.
6. Open `Sound Library`:
   - Click `Add sound files` (or `Select sounds directory`).
   - Confirm files appear in the `Sounds` list.
7. Go back to `Active Areas`, then set each zone `Sound`.
8. Switch `Mode` to `Performance`.
9. Move through a zone. You should hear the assigned sound.

If no sound plays, jump to [Troubleshooting FAQ](#troubleshooting-faq).

## Core Workflow

### 1) Configure Zones

- Set `Active zones` to the number of trigger areas you want.
- Drag zones directly on the canvas.
- Select a zone (click it), then resize with keyboard arrows:
  - `ArrowUp` / `ArrowDown`: height
  - `ArrowLeft` / `ArrowRight`: width
- Use `Reset zones` to return to default layout.

Tip: A small music note on a zone means a sound is assigned. Clicking the note in `Edit` mode previews that zone sound.

### 2) Import and Manage Sounds

In `Sound Library`:

- `Add sound files`: pick individual files.
- `Select sounds directory`: import many sounds at once (browser support varies).
- `Play`: test a sound from the list.
- `Delete`: remove one sound.
- `Reset library`: remove all loaded sounds.

### 3) Assign Sounds to Zones

For each zone in `Active Areas`:

- Pick a `Sound`.
- Optional: click `▷` to preview the zone assignment.
- Adjust `Pan` (left/right placement).
- Adjust `Volume`.
- Choose playback behavior:
  - `Overdub while playing`: allows retriggering while sound is still playing.
  - `Stop zone audio on leave`: mainly useful with presence detection.

### 4) Switch Between Edit and Performance

- `Edit` mode:
  - You can change controls, move zones, and assign sounds.
- `Performance` mode:
  - Controls are locked.
  - Camera analysis is active.
  - Zone overlays show live activity.
  - Background track (if selected) loops.

Use `Edit` to configure, then `Performance` to perform.

## Detection Tuning (Plain Language)

### Detection Modes

- `Motion`: triggers when frame-to-frame change is detected in a zone.
- `Presence`: triggers when something remains present against an adaptive baseline.

You can set:

- `Default detection` for all zones.
- Per-zone `Detection mode` override.

### Sliders

- `Image filter threshold`
  - Higher values ignore small pixel differences (less sensitive).
  - Lower values react to subtle changes (more sensitive).
- `Movement threshold`
  - Higher values require more visible change before triggering.
  - Lower values trigger more easily.

### Recommended Baseline Settings

Start here, then adjust in small steps:

- `Process resolution`: low or medium for stable FPS.
- `Image filter threshold`: around `0.30`.
- `Movement threshold`: around `0.02`.
- `Default detection`: `Motion` for first setup.

If the app triggers too often:

- Raise `Movement threshold` first.
- Then raise `Image filter threshold` slightly.

If the app misses movement:

- Lower `Movement threshold`.
- Improve lighting and reduce strong shadows.

## Sound and Background Track Reference

### Zone Audio Controls

- `Pan`: `-1` full left, `0` center, `1` full right.
- `Volume`: `0` silent to `1` maximum.
- `Overdub while playing`:
  - On: retriggering layers/overlaps sound.
  - Off: retrigger is ignored until current playback ends.
- `Stop zone audio on leave`:
  - On: when presence exits a zone, active zone audio stops.

### Background Track

In `Sound Library` > `Background Track`:

- Choose `Track` from imported sounds.
- Set background `Volume`.
- Background track loops in `Performance` mode.

## Saved Data and Reset Behavior

Object Synth stores settings locally in your browser:

- Zones layout and zone options.
- Detection settings and selected camera.
- Processing settings and FPS display toggle.
- Background volume.
- Imported sound library (browser local database).

What reset actions do:

- `Reset zones`: resets zone layout/options to defaults.
- `Reset library`: clears all imported sounds from local library.

If you want a full fresh start, use both reset actions.

## Troubleshooting FAQ

### Camera does not appear

- Check browser camera permission is `Allow`.
- Re-select the camera in `Input Source`.
- Close other apps that may be using the webcam.
- Reload the page after changing permissions.

### I can see video but zones do not trigger

- Confirm you are in `Performance` mode.
- Make sure each zone has a `Sound` assigned.
- Lower `Movement threshold` slightly.
- Check lighting; avoid very dark scenes.

### Sound list is loaded but I hear nothing

- Use `Play` in the sound list to confirm output device works.
- Raise zone `Volume` and center `Pan` (`0`) while testing.
- Turn on `Overdub while playing` to make retrigger testing easier.
- Ensure your system output is not muted.

### `Select sounds directory` does nothing or is unavailable

- Some browsers do not support directory picking.
- Use `Add sound files` instead.

### Performance is choppy / low FPS

- Lower `Process resolution`.
- Reduce number of active zones.
- Disable heavy background apps.
- Turn on `Show FPS overlay` to monitor improvements.

### Triggers are too noisy (too many false positives)

- Raise `Movement threshold`.
- Raise `Image filter threshold` slightly.
- Reduce moving background elements (fans, screens, reflections).

### Presence mode feels sticky or slow

- Presence needs a short baseline period.
- Enter `Performance` mode and wait briefly before testing.
- Improve lighting consistency to help baseline updates.

## Glossary

- Zone: rectangle on canvas used as a trigger area.
- Motion: detection based on frame-to-frame movement.
- Presence: detection based on sustained difference from baseline.
- Overdub: allow new playback before previous playback ends.
- Background track: looped audio bed in performance mode.
