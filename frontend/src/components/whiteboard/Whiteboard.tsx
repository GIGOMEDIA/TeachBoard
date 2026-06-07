import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useStore } from '../../store/useStore';
import {
  Brush,
  Eraser,
  MousePointer,
  Square,
  Compass,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2
} from 'lucide-react';

interface WhiteboardProps {
  canvasRef: React.MutableRefObject<any>;
}

// Module-level global disposal promise to prevent double-initialization in React StrictMode
let globalDisposalPromise: Promise<void> | null = null;

export default function Whiteboard({ canvasRef }: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    user,
    socket,
    isConnected,
    currentTool,
    currentColor,
    currentStrokeWidth,
    backgroundType,
    boards,
    activeBoardIndex,
    setTool,
    setColor,
    saveActiveBoardData,
  } = useStore();

  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const isDrawingShape = useRef(false);
  const shapeStartPoint = useRef<{ x: number, y: number } | null>(null);
  const activeShape = useRef<fabric.Object | null>(null);

  // Real-time pointer tracking refs
  const isTeacherDrawing = useRef(false);
  const studentLastPoint = useRef<{ x: number, y: number } | null>(null);
  const studentDrawColor = useRef<string>('#14b8a6');
  const studentDrawWidth = useRef<number>(3);

  // Initialize canvas
  useEffect(() => {
    let active = true;
    let canvas: any = null;

    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      canvasRef.current.setWidth(width);
      canvasRef.current.setHeight(height);
      const zoomFactor = width / 1920;
      canvasRef.current.setZoom(zoomFactor);
      drawBackgroundGrid(canvasRef.current, useStore.getState().backgroundType);
    };

    const initCanvas = async () => {
      // Wait for any previous canvas disposal to finish
      if (globalDisposalPromise) {
        await globalDisposalPromise;
      }

      if (!active) return;
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      // Double check that we don't try to double-initialize if another useEffect run got there first
      if (canvasRef.current) return;

      // Create Canvas instance
      canvas = new fabric.Canvas('whiteboard-canvas', {
        width: width,
        height: height,
        isDrawingMode: true,
        selection: false,
        stopContextMenu: true,
      });

      canvasRef.current = canvas;

      // Set initial zoom factor based on 1920 virtual width
      const initialZoom = width / 1920;
      canvas.setZoom(initialZoom);

      // Setup background grid
      drawBackgroundGrid(canvas, backgroundType);

      // Save initial state
      saveState(canvas);

      window.addEventListener('resize', handleResize);

      // Pointer events for cursor coordinates sync
      canvas.on('mouse:move', (options: any) => {
        if (options.pointer && socket && isConnected) {
          socket.emit('cursor-move', {
            x: options.pointer.x,
            y: options.pointer.y
          });
        }
      });

      // Real-time drawing pointer sync (Teacher side)
      canvas.on('mouse:down', (o: any) => {
        const currentUser = useStore.getState().user;
        if (currentUser?.role !== 'teacher') return;

        if (canvas.isDrawingMode) {
          isTeacherDrawing.current = true;
          const pointer = o.scenePoint || canvas.getPointer(o.e);
          socket.emit('draw-pointer', {
            event: 'down',
            x: pointer.x,
            y: pointer.y,
            color: canvas.freeDrawingBrush?.color || currentColor,
            width: canvas.freeDrawingBrush?.width || currentStrokeWidth
          });
        }
      });

      canvas.on('mouse:move', (o: any) => {
        const currentUser = useStore.getState().user;
        if (currentUser?.role !== 'teacher') return;

        if (isTeacherDrawing.current && canvas.isDrawingMode) {
          const pointer = o.scenePoint || canvas.getPointer(o.e);
          socket.emit('draw-pointer', {
            event: 'move',
            x: pointer.x,
            y: pointer.y
          });
        }
      });

      canvas.on('mouse:up', () => {
        const currentUser = useStore.getState().user;
        if (currentUser?.role !== 'teacher') return;

        if (isTeacherDrawing.current) {
          isTeacherDrawing.current = false;
          socket.emit('draw-pointer', { event: 'up' });
        }
      });

      // Object events for history/undo/redo and socket sync
      canvas.on('object:added', (e: any) => {
        if (e.target && !e.target.isGridLine && !isDrawingShape.current) {
          // Tag with random ID if not already synced from someone else
          if (!e.target.id) {
            e.target.id = Math.random().toString(36).substr(2, 9);
          }
          saveState(canvas);
          broadcastCanvas(canvas);
        }
      });

      canvas.on('object:modified', () => {
        saveState(canvas);
        broadcastCanvas(canvas);
      });

      canvas.on('object:removed', (e: any) => {
        if (e.target && !e.target.isGridLine) {
          saveState(canvas);
          broadcastCanvas(canvas);
        }
      });

      // MouseDown event for shape drawing
      canvas.on('mouse:down', (o: any) => {
        if (canvas.isDrawingMode) return;
        
        const pointer = o.scenePoint;
        shapeStartPoint.current = { x: pointer.x, y: pointer.y };
        const tool = useStore.getState().currentTool;
        const color = useStore.getState().currentColor;
        const strokeWidth = useStore.getState().currentStrokeWidth;

        if (['rectangle', 'circle', 'triangle', 'arrow', 'line'].includes(tool)) {
          isDrawingShape.current = true;
          
          let shape: fabric.Object | null = null;
          if (tool === 'rectangle') {
            shape = new fabric.Rect({
              left: pointer.x,
              top: pointer.y,
              width: 0,
              height: 0,
              fill: 'transparent',
              stroke: color,
              strokeWidth: strokeWidth,
              selectable: false,
              // @ts-ignore
              id: Math.random().toString(36).substr(2, 9)
            });
          } else if (tool === 'circle') {
            shape = new fabric.Circle({
              left: pointer.x,
              top: pointer.y,
              radius: 0,
              fill: 'transparent',
              stroke: color,
              strokeWidth: strokeWidth,
              selectable: false,
              // @ts-ignore
              id: Math.random().toString(36).substr(2, 9)
            });
          } else if (tool === 'triangle') {
            shape = new fabric.Triangle({
              left: pointer.x,
              top: pointer.y,
              width: 0,
              height: 0,
              fill: 'transparent',
              stroke: color,
              strokeWidth: strokeWidth,
              selectable: false,
              // @ts-ignore
              id: Math.random().toString(36).substr(2, 9)
            });
          } else if (tool === 'line' || tool === 'arrow') {
            shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: color,
              strokeWidth: strokeWidth,
              selectable: false,
              // @ts-ignore
              id: Math.random().toString(36).substr(2, 9)
            });
          }

          if (shape) {
            activeShape.current = shape;
            canvas.add(shape);
          }
        } else if (tool === 'text') {
          const text = new fabric.IText('Double click to edit', {
            left: pointer.x,
            top: pointer.y,
            fontFamily: 'sans-serif',
            fill: color,
            fontSize: 22,
            // @ts-ignore
            id: Math.random().toString(36).substr(2, 9)
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          setTool('select');
        } else if (tool === 'sticky') {
          const sticky = createStickyNote(pointer.x, pointer.y, 'New Note');
          canvas.add(sticky);
          canvas.setActiveObject(sticky);
          setTool('select');
        } else if (tool === 'eraser') {
          if (o.target && !o.target.isGridLine) {
            canvas.remove(o.target);
            canvas.discardActiveObject();
            canvas.renderAll();
          }
        }
      });

      // MouseMove event for updating shapes bounding boxes during drawing drags
      canvas.on('mouse:move:before', (o: any) => {
        if (!isDrawingShape.current || !activeShape.current || !shapeStartPoint.current) return;
        
        const pointer = o.scenePoint;
        const width = Math.abs(pointer.x - shapeStartPoint.current.x);
        const height = Math.abs(pointer.y - shapeStartPoint.current.y);
        const tool = useStore.getState().currentTool;

        if (tool === 'rectangle' || tool === 'triangle') {
          activeShape.current.set({
            left: Math.min(pointer.x, shapeStartPoint.current.x),
            top: Math.min(pointer.y, shapeStartPoint.current.y),
            width: width,
            height: height
          });
        } else if (tool === 'circle') {
          activeShape.current.set({
            left: Math.min(pointer.x, shapeStartPoint.current.x),
            top: Math.min(pointer.y, shapeStartPoint.current.y),
            // @ts-ignore
            radius: Math.max(width, height) / 2
          });
        } else if (tool === 'line' || tool === 'arrow') {
          const line = activeShape.current as fabric.Line;
          line.set({
            x2: pointer.x,
            y2: pointer.y
          });
        }

        canvas.requestRenderAll();
      });

      // MouseUp event to finalize shape drawing
      canvas.on('mouse:up', () => {
        if (isDrawingShape.current && activeShape.current) {
          const tool = useStore.getState().currentTool;
          
          if (tool === 'arrow' && shapeStartPoint.current) {
            const line = activeShape.current as fabric.Line;
            canvas.remove(line);
            
            const arrowObj = createArrowObject(
              line.x1!, line.y1!, line.x2!, line.y2!,
              useStore.getState().currentColor,
              useStore.getState().currentStrokeWidth
            );
            canvas.add(arrowObj);
          } else {
            activeShape.current.set({ selectable: true });
          }

          isDrawingShape.current = false;
          activeShape.current = null;
          saveState(canvas);
          broadcastCanvas(canvas);
        }
      });
    };

    initCanvas();

    // Cleanup
    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current) {
        const c = canvasRef.current;
        canvasRef.current = null;
        globalDisposalPromise = c.dispose().then(() => {
          globalDisposalPromise = null;
        });
      }
    };
  }, []);

  // Update canvas state when tool changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.discardActiveObject();
    canvas.renderAll();

    const role = useStore.getState().user?.role;
    if (role === 'student') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject((obj: any) => {
        obj.selectable = false;
        obj.evented = false;
      });
      return;
    }

    if (currentTool === 'pencil') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = currentStrokeWidth;
    } else if (currentTool === 'highlighter') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      // Alpha opacity highlighter
      canvas.freeDrawingBrush.color = hexToRGBA(currentColor, 0.4);
      canvas.freeDrawingBrush.width = currentStrokeWidth * 3;
    } else if (currentTool === 'select') {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.forEachObject((obj: any) => {
        if (!obj.isGridLine) obj.selectable = true;
      });
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject((obj: any) => {
        obj.selectable = false;
      });
    }
  }, [currentTool, currentColor, currentStrokeWidth]);

  // Sync background modifications
  useEffect(() => {
    if (canvasRef.current) {
      drawBackgroundGrid(canvasRef.current, backgroundType);
    }
  }, [backgroundType]);

  // Sync boards changes (local state reload)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const savedBoardJSON = boards[activeBoardIndex];
    if (savedBoardJSON) {
      const cleanData = JSON.parse(savedBoardJSON);
      delete cleanData.viewportTransform;

      canvas.loadFromJSON(cleanData).then(() => {
        const role = useStore.getState().user?.role;
        if (role === 'student') {
          canvas.forEachObject((obj: any) => {
            obj.selectable = false;
            obj.evented = false;
          });
        }
        const zoomFactor = canvas.getWidth() / 1920;
        canvas.setZoom(zoomFactor);
        drawBackgroundGrid(canvas, useStore.getState().backgroundType);
        canvas.requestRenderAll();
      });
    } else {
      clearCanvasLocal();
    }
  }, [activeBoardIndex]);

  // Sync Sockets updates from peers
  useEffect(() => {
    if (!socket) return;

    socket.on('canvas-update-received', (data: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const cleanData = typeof data === 'string' ? JSON.parse(data) : { ...data };
      delete cleanData.viewportTransform;

      canvas.loadFromJSON(cleanData).then(() => {
        const role = useStore.getState().user?.role;
        if (role === 'student') {
          canvas.forEachObject((obj: any) => {
            obj.selectable = false;
            obj.evented = false;
          });
        }
        const zoomFactor = canvas.getWidth() / 1920;
        canvas.setZoom(zoomFactor);
        drawBackgroundGrid(canvas, useStore.getState().backgroundType);
        canvas.requestRenderAll();
      });
    });

    socket.on('canvas-clear-received', () => {
      clearCanvasLocal();
    });

    // Real-time student draw pointer replication
    socket.on('draw-pointer-received', ({ event, x, y, color, width }: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const role = useStore.getState().user?.role;
      if (role !== 'student') return; // Only students replicate the teacher's stream

      if (event === 'down') {
        studentLastPoint.current = { x, y };
        studentDrawColor.current = color;
        studentDrawWidth.current = width;
      } 
      else if (event === 'move' && studentLastPoint.current) {
        const line = new fabric.Line([
          studentLastPoint.current.x,
          studentLastPoint.current.y,
          x,
          y
        ], {
          stroke: studentDrawColor.current,
          strokeWidth: studentDrawWidth.current,
          selectable: false,
          evented: false,
          // @ts-ignore
          isTempLine: true
        });
        canvas.add(line);
        canvas.requestRenderAll();
        studentLastPoint.current = { x, y };
      } 
      else if (event === 'up') {
        // Clear all temporary drawing lines
        const tempObjects = canvas.getObjects().filter((obj: any) => obj.isTempLine);
        tempObjects.forEach((obj: any) => canvas.remove(obj));
        canvas.requestRenderAll();
        studentLastPoint.current = null;
      }
    });

    // Sync newly joined users
    socket.on('user-joined', () => {
      const canvas = canvasRef.current;
      const role = useStore.getState().user?.role;
      if (role === 'teacher') {
        if (canvas) {
          broadcastCanvas(canvas);
        }
        socket.emit('canvas-board-switch', useStore.getState().activeBoardIndex);
      }
    });

    return () => {
      socket.off('canvas-update-received');
      socket.off('canvas-clear-received');
      socket.off('draw-pointer-received');
      socket.off('user-joined');
    };
  }, [socket]);

  // Helpers
  const hexToRGBA = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const drawBackgroundGrid = (canvas: any, type: string) => {
    // Clear existing grid lines
    const gridLines = canvas.getObjects().filter((obj: any) => obj.isGridLine);
    gridLines.forEach((line: any) => canvas.remove(line));

    if (type === 'blank') {
      canvas.backgroundColor = '#020617';
      canvas.requestRenderAll();
      return;
    }

    const zoom = canvas.getZoom() || 1;
    const width = canvas.getWidth() / zoom;
    const height = canvas.getHeight() / zoom;

    if (type === 'grid') {
      canvas.backgroundColor = '#020617';
      const grid = 40;

      for (let i = 0; i < width; i += grid) {
        canvas.add(new fabric.Line([i, 0, i, height], {
          stroke: '#1e293b',
          selectable: false,
          evented: false,
          // @ts-ignore
          isGridLine: true
        }));
      }

      for (let i = 0; i < height; i += grid) {
        canvas.add(new fabric.Line([0, i, width, i], {
          stroke: '#1e293b',
          selectable: false,
          evented: false,
          // @ts-ignore
          isGridLine: true
        }));
      }
      canvas.requestRenderAll();
    }

    if (type === 'coordinate') {
      canvas.backgroundColor = '#020617';
      const centerX = width / 2;
      const centerY = height / 2;

      // X Axis
      canvas.add(new fabric.Line([0, centerY, width, centerY], {
        stroke: '#14b8a6',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        // @ts-ignore
        isGridLine: true
      }));

      // Y Axis
      canvas.add(new fabric.Line([centerX, 0, centerX, height], {
        stroke: '#14b8a6',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        // @ts-ignore
        isGridLine: true
      }));

      // Grid lines tick spacing
      const step = 40;
      for (let offset = step; offset < width / 2; offset += step) {
        // X ticks
        canvas.add(new fabric.Line([centerX + offset, centerY - 6, centerX + offset, centerY + 6], {
          stroke: '#14b8a6', strokeWidth: 1.5, selectable: false, evented: false, // @ts-ignore
          isGridLine: true
        }));
        canvas.add(new fabric.Line([centerX - offset, centerY - 6, centerX - offset, centerY + 6], {
          stroke: '#14b8a6', strokeWidth: 1.5, selectable: false, evented: false, // @ts-ignore
          isGridLine: true
        }));
        // Y ticks
        canvas.add(new fabric.Line([centerX - 6, centerY - offset, centerX + 6, centerY - offset], {
          stroke: '#14b8a6', strokeWidth: 1.5, selectable: false, evented: false, // @ts-ignore
          isGridLine: true
        }));
        canvas.add(new fabric.Line([centerX - 6, centerY + offset, centerX + 6, centerY + offset], {
          stroke: '#14b8a6', strokeWidth: 1.5, selectable: false, evented: false, // @ts-ignore
          isGridLine: true
        }));
      }
      canvas.requestRenderAll();
    }
  };

  const createStickyNote = (x: number, y: number, textVal: string) => {
    const rect = new fabric.Rect({
      width: 150,
      height: 150,
      fill: '#fef08a',
      stroke: '#eab308',
      strokeWidth: 1,
      rx: 5,
      ry: 5,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.15)',
        blur: 10,
        offsetX: 5,
        offsetY: 5
      })
    });

    const text = new fabric.Textbox(textVal, {
      width: 130,
      fontSize: 16,
      fontFamily: 'sans-serif',
      fill: '#1e293b',
      textAlign: 'center',
      left: 10,
      top: 25,
      splitByGrapheme: true
    });

    const group = new fabric.Group([rect, text], {
      left: x,
      top: y,
      subTargetCheck: true,
      borderColor: '#38bdf8',
      // @ts-ignore
      id: Math.random().toString(36).substr(2, 9)
    });

    return group;
  };

  const createArrowObject = (x1: number, y1: number, x2: number, y2: number, color: string, strokeWidth: number) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 15;

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: color,
      strokeWidth: strokeWidth,
      selectable: false
    });

    const arrowHead = new fabric.Triangle({
      left: x2,
      top: y2,
      angle: (angle * 180 / Math.PI) + 90,
      width: headLength + strokeWidth,
      height: headLength + strokeWidth,
      fill: color,
      originX: 'center',
      originY: 'center',
      selectable: false
    });

    const group = new fabric.Group([line, arrowHead], {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      selectable: true,
      borderColor: '#38bdf8',
      // @ts-ignore
      id: Math.random().toString(36).substr(2, 9)
    });

    return group;
  };

  // State Management Undo / Redo
  const saveState = (canvas: any) => {
    const json = canvas.toJSON(['id']);
    // Exclude grid lines from state logs
    json.objects = json.objects.filter((obj: any) => !obj.isGridLine);
    
    const stateStr = JSON.stringify(json);
    setUndoStack((prev) => [...prev, stateStr]);
    setRedoStack([]); // Clear redo
    
    // Save to global store
    saveActiveBoardData(stateStr);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.length <= 1) return;

    const current = undoStack[undoStack.length - 1];
    const rest = undoStack.slice(0, -1);
    
    setUndoStack(rest);
    setRedoStack((prev) => [...prev, current]);

    const targetState = rest[rest.length - 1];
    const cleanState = JSON.parse(targetState);
    delete cleanState.viewportTransform;

    canvas.loadFromJSON(cleanState).then(() => {
      const zoomFactor = canvas.getWidth() / 1920;
      canvas.setZoom(zoomFactor);
      drawBackgroundGrid(canvas, useStore.getState().backgroundType);
      canvas.requestRenderAll();
      broadcastCanvas(canvas);
    });
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, nextState]);

    const cleanState = JSON.parse(nextState);
    delete cleanState.viewportTransform;

    canvas.loadFromJSON(cleanState).then(() => {
      const zoomFactor = canvas.getWidth() / 1920;
      canvas.setZoom(zoomFactor);
      drawBackgroundGrid(canvas, useStore.getState().backgroundType);
      canvas.requestRenderAll();
      broadcastCanvas(canvas);
    });
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.clear();
    drawBackgroundGrid(canvas, useStore.getState().backgroundType);
    canvas.requestRenderAll();
  };

  const handleClear = () => {
    clearCanvasLocal();
    const canvas = canvasRef.current;
    if (canvas) {
      saveState(canvas);
      broadcastCanvas(canvas);
      if (isConnected && socket) {
        socket.emit('canvas-clear');
      }
    }
  };

  const broadcastCanvas = (canvas: any) => {
    if (isConnected && socket) {
      const json = canvas.toJSON(['id']);
      json.objects = json.objects.filter((obj: any) => !obj.isGridLine);
      socket.emit('canvas-update', json);
    }
  };

  const colorsList = ['#2563EB', '#0EA5E9', '#14B8A6', '#F59E0B', '#EF4444', '#FFFFFF'];

  return (
    <div className="relative flex-1 h-full w-full bg-slate-950" ref={containerRef}>
      {/* HTML Drawing Canvas element */}
      <canvas id="whiteboard-canvas" className="w-full h-full block" />

      {/* Floating Toolbar Panel (Teachers only) */}
      {user?.role === 'teacher' && (
        <div className="absolute md:left-4 md:top-4 md:bottom-auto md:right-auto md:flex-col flex-row bottom-4 left-4 right-4 h-16 md:h-auto bg-slate-900/90 backdrop-blur border border-white/10 rounded-2xl p-2.5 md:p-2.5 shadow-2xl z-[100] flex items-center md:items-stretch gap-2.5 select-none overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTool('pencil')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'pencil' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Pencil Brush"
          >
            <Brush size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Pencil</span>
          </button>

          <button
            onClick={() => setTool('highlighter')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'highlighter' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Highlighter"
          >
            <Brush className="opacity-60" size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Highlight</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'eraser' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Object Eraser"
          >
            <Eraser size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Eraser</span>
          </button>

          <button
            onClick={() => setTool('select')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'select' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Select Object"
          >
            <MousePointer size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Select</span>
          </button>

          <button
            onClick={() => setTool('rectangle')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'rectangle' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Rectangle"
          >
            <Square size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Rect</span>
          </button>

          <button
            onClick={() => setTool('circle')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'circle' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Circle"
          >
            <Compass size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Circle</span>
          </button>

          <button
            onClick={() => setTool('text')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'text' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Text Label"
          >
            <Type size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Text</span>
          </button>

          <button
            onClick={() => setTool('sticky')}
            className={`p-3 md:p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
              currentTool === 'sticky' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Sticky Note"
          >
            <StickyNote size={20} />
            <span className="text-[9px] font-bold hidden md:inline">Note</span>
          </button>

          <div className="md:w-8 md:h-px w-px h-8 bg-white/10 mx-1.5 md:my-1 self-center flex-shrink-0" />

          {/* Colors Picker */}
          <div className="flex md:flex-col flex-row gap-2 items-center">
            {colorsList.map((col) => (
              <button
                key={col}
                onClick={() => setColor(col)}
                className="w-7 h-7 md:w-4 md:h-4 rounded-full border border-black/30 transition-all duration-200 flex-shrink-0"
                style={{
                  backgroundColor: col,
                  transform: currentColor === col ? 'scale(1.25)' : 'none',
                  borderColor: currentColor === col ? '#ffffff' : 'rgba(0,0,0,0.3)',
                  boxShadow: currentColor === col ? '0 0 5px rgba(255,255,255,0.6)' : 'none'
                }}
              />
            ))}
          </div>

          <div className="md:w-8 md:h-px w-px h-8 bg-white/10 mx-1.5 md:my-1 self-center flex-shrink-0" />

          {/* Action triggers */}
          <div className="flex md:flex-col flex-row gap-2.5 items-center">
            <button
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="p-2.5 md:p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all flex-shrink-0"
              title="Undo"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-2.5 md:p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all flex-shrink-0"
              title="Redo"
            >
              <Redo2 size={18} />
            </button>
            <button
              onClick={handleClear}
              className="p-2.5 md:p-1 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl md:rounded transition-all flex-shrink-0"
              title="Clear Board"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
