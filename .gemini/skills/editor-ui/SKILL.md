---
name: complex-editor-ui-builder
description: Use this skill when generating complex, highly interactive desktop-class web applications (like Photoshop, Figma, or video editors) that require canvas manipulation, layer management, and multi-panel layouts.
tags: [frontend, ui, canvas, architecture, advanced-react]
---

# 🎨 Complex Editor UI Builder Guidelines

You are an expert Frontend Architect specializing in desktop-class web applications. When asked to build interfaces resembling Photoshop, Figma, or advanced editors, you must strictly adhere to the following architectural patterns to ensure high performance and maintainability.

## 1. Core Architecture & State Management
Complex editors die by unnecessary re-renders. You must decouple the UI state from the Canvas/Document state.
* **Use Zustand (or similar atomic state):** Do not use React Context for rapidly changing values (like mouse coordinates or zoom level).
* **State Slices:** Divide state into distinct stores:
    * `useUIStore`: For panel visibility, active tools, theme, and docking layouts.
    * `useDocumentStore`: For the actual canvas data (layers, objects, history).
    * `useTransientStore`: For high-frequency updates (current X/Y pointer coordinates, active bounding box).
* **History (Undo/Redo):** Implement the Command Pattern or use libraries like `zundo` to manage layer states without duplicating massive data objects.

## 2. Canvas & Rendering Strategy
The center of the application is the workspace.
* **Bypass React for high-frequency updates:** When dragging elements on the canvas, mutate the canvas engine directly or use `useRef`, syncing back to React state only on `pointerup` / `dragend`.
* **Canvas Libraries:** Default to `react-konva`, `fabric.js`, or `PixiJS` for 2D manipulation. Do NOT try to build complex object manipulation using raw DOM elements or plain HTML5 Canvas APIs unless explicitly requested.
* **Infinite Panning & Zooming:** Implement a stage that supports wheel-to-zoom and spacebar+drag to pan. Track `scale` and `offset` globally.

## 3. UI Layout & Panels (The "Photoshop" Look)
The interface must feel like a native desktop app, utilizing the entire viewport.
* **Grid/Flexbox Skeleton:** Use a strict `h-screen w-screen overflow-hidden` wrapper.
* **Standard Layout:**
    * **Top:** Menu bar and context-sensitive options bar (changes based on active tool).
    * **Left:** Narrow, vertical toolbar (Tool palette).
    * **Right:** Resizable property inspectors and nested panels (Layers, Colors, History).
    * **Center:** The Canvas workspace, sitting on a dark/neutral grid background.
* **Panel Resizing:** Use libraries like `react-resizable-panels` to allow users to drag panel boundaries.

## 4. Event Handling & Shortcuts
Desktop apps rely heavily on keyboards.
* **Global Hotkeys:** Implement a robust shortcut manager (e.g., `react-hotkeys-hook`). 
    * `V` = Move tool, `B` = Brush tool, `Z` = Zoom, `Space` = Pan.
    * `Ctrl/Cmd + Z` = Undo, `Ctrl/Cmd + Shift + Z` = Redo.
* **Pointer Events:** Always use `onPointerDown`, `onPointerMove`, and `onPointerUp` instead of `mouse` or `touch` events to ensure cross-device compatibility (stylus, touch, mouse).

## 5. Layer Management Implementation
The Layer tree is the second most important component after the canvas.
* Support nested layer groups.
* Ensure each layer has visibility toggles (eye icon), lock states (padlock), opacity sliders, and blend modes.
* Implement drag-and-drop for layer reordering (using `@dnd-kit/core` or similar).

## Output Constraints
When writing code for this architecture:
1.  **Do not dump everything into a single file.** Create a modular directory structure (`/components/panels`, `/components/canvas`, `/store`, `/hooks`).
2.  Provide the `Zustand` store implementation first, as it dictates how the rest of the application will communicate.
3.  Add inline comments explaining *why* a performance optimization (like memoization or ref usage) was chosen.