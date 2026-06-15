import React, { useState, useEffect } from 'react';
import * as fabric from 'fabric';
import { useStore } from '../../store/useStore';
import Whiteboard from '../whiteboard/Whiteboard';
import Calculator from '../tools/Calculator';
import AIAssistant from '../ai/AIAssistant';
import {
  Users,
  Brain,
  Calculator as CalcIcon,
  Hand,
  Send,
  X,
  Plus,
  CheckCircle,
  Mic,
  MicOff,
  Volume2,
  PenTool,
  MessageSquare
} from 'lucide-react';

interface ClassroomProps {
  setView: (view: 'dashboard' | 'classroom') => void;
}

export default function Classroom({ setView }: ClassroomProps) {
  const canvasRef = React.useRef<fabric.Canvas | null>(null);

  const {
    user,
    roomCode,
    socket,
    joinedUsers,
    chatHistory,
    questions,
    sendChatMessage,
    toggleHandRaise,
    submitQuestion,
    resolveQuestion,
    disconnectRoom,
    
    // Tools
    backgroundType,
    activeBoardIndex,
    setBackgroundType,
    switchBoard,
    
    // Toggles
    isCalcVisible,
    setCalcVisible,
    isAIPanelVisible,
    setAIPanelVisible
  } = useStore();

  const [isRosterVisible, setRosterVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [questionInput, setQuestionInput] = useState('');

  // Mobile responsiveness states
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'board' | 'chat' | 'roster' | 'ai'>('board');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMobileTabChange = (tab: 'board' | 'chat' | 'roster' | 'ai') => {
    setActiveMobileTab(tab);
    if (tab === 'board') {
      setRosterVisible(false);
      setAIPanelVisible(false);
    } else if (tab === 'chat' || tab === 'roster') {
      setRosterVisible(true);
      setAIPanelVisible(false);
    } else if (tab === 'ai') {
      setRosterVisible(false);
      setAIPanelVisible(true);
    }
  };

  useEffect(() => {
    if (!isAIPanelVisible && activeMobileTab === 'ai') {
      setActiveMobileTab('board');
    }
  }, [isAIPanelVisible]);

  useEffect(() => {
    if (!isRosterVisible && (activeMobileTab === 'chat' || activeMobileTab === 'roster')) {
      setActiveMobileTab('board');
    }
  }, [isRosterVisible]);

  // Voice States
  const [isBroadcastingVoice, setIsBroadcastingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // WebRTC Refs
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const peerConnectionsRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  // Dynamic voice store functions
  const {
    startVoiceBroadcast,
    stopVoiceBroadcast
  } = useStore();

  // Stop broadcasting local audio stream
  const stopLocalVoice = React.useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    console.log('WebRTC: Closed all active sending streams');
  }, []);

  // Toggle voice broadcast (Teacher or Approved student)
  const handleToggleVoiceBroadcast = async () => {
    if (isBroadcastingVoice) {
      stopLocalVoice();
      stopVoiceBroadcast();
      setIsBroadcastingVoice(false);
    } else {
      try {
        setVoiceError(null);
        console.log('WebRTC: Accessing microphone...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        
        startVoiceBroadcast();
        setIsBroadcastingVoice(true);
      } catch (err: any) {
        console.error('WebRTC: Microphone access failed', err);
        setVoiceError(err.message || 'Microphone access denied');
      }
    }
  };



  // WebRTC mesh signaling sync
  React.useEffect(() => {
    if (!socket) return;

    // Listen for incoming voice signaling
    socket.on('voice-signal-received', async ({ senderSocketId, signal }: any) => {
      console.log(`WebRTC: Signal received from ${senderSocketId}: ${signal.type}`);
      
      try {
        if (signal.type === 'initiate') {
          if (!localStreamRef.current) {
            console.warn('WebRTC: Received initiate signal but local mic stream is inactive.');
            return;
          }

          // Create sender connection
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          });

          // Add mic track
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
          });

          // ICE Candidates
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('voice-signal', {
                targetSocketId: senderSocketId,
                signal: { type: 'candidate', candidate: event.candidate }
              });
            }
          };

          peerConnectionsRef.current.set(senderSocketId, pc);

          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('voice-signal', {
            targetSocketId: senderSocketId,
            signal: { type: 'offer', sdp: offer.sdp }
          });
        } 
        else if (signal.type === 'offer') {
          // Listener PC to receive audio
          let pc = peerConnectionsRef.current.get(senderSocketId);
          if (!pc) {
            pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                socket.emit('voice-signal', {
                  targetSocketId: senderSocketId,
                  signal: { type: 'candidate', candidate: event.candidate }
                });
              }
            };
            pc.ontrack = (event) => {
              console.log(`WebRTC: Received audio track from sender ${senderSocketId}`);
              const remoteStream = event.streams[0] || new MediaStream([event.track]);
              let audio = audioElementsRef.current.get(senderSocketId);
              if (!audio) {
                audio = document.createElement('audio');
                audio.autoplay = true;
                audio.setAttribute('playsinline', 'true');
                audio.style.display = 'none';
                document.body.appendChild(audio);
                audioElementsRef.current.set(senderSocketId, audio);
              }
              audio.srcObject = remoteStream;
              audio.play().catch(e => console.warn('Audio auto-play failed. Interaction required.', e));
            };
            peerConnectionsRef.current.set(senderSocketId, pc);
          }

          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('voice-signal', {
            targetSocketId: senderSocketId,
            signal: { type: 'answer', sdp: answer.sdp }
          });
        } 
        else if (signal.type === 'answer') {
          const pc = peerConnectionsRef.current.get(senderSocketId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          }
        } 
        else if (signal.type === 'candidate') {
          const pc = peerConnectionsRef.current.get(senderSocketId);
          if (pc && signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch (err) {
        console.error('WebRTC: Signaling candidate/description mapping failed', err);
      }
    });

    return () => {
      socket.off('voice-signal-received');
    };
  }, [socket, startVoiceBroadcast, stopVoiceBroadcast, stopLocalVoice]);

  // Sync listener connections when roster isSpeaking updates
  React.useEffect(() => {
    if (!socket) return;
    const myId = socket.id;

    // Filter everyone else speaking in the room
    const speakers = joinedUsers.filter(u => u.isSpeaking && u.socketId !== myId);
    const speakerIds = new Set(speakers.map(u => u.socketId));

    // 1. Clean up stale listener channels
    peerConnectionsRef.current.forEach((pc, id) => {
      if (!speakerIds.has(id) && (!localStreamRef.current || !pc.getSenders().length)) {
        pc.close();
        peerConnectionsRef.current.delete(id);
        
        const audio = audioElementsRef.current.get(id);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          if (audio.parentNode) audio.parentNode.removeChild(audio);
          audioElementsRef.current.delete(id);
        }
        console.log(`WebRTC: Closed receiver connection to socket ${id}`);
      }
    });

    // 2. Initiate listener channels for new speakers
    speakers.forEach(sp => {
      if (!peerConnectionsRef.current.has(sp.socketId)) {
        console.log(`WebRTC: Initiating listening channel to ${sp.name}...`);
        
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('voice-signal', {
              targetSocketId: sp.socketId,
              signal: { type: 'candidate', candidate: event.candidate }
            });
          }
        };

        pc.ontrack = (event) => {
          console.log(`WebRTC: Playback audio track received from ${sp.name}`);
          const remoteStream = event.streams[0] || new MediaStream([event.track]);
          
          let audio = audioElementsRef.current.get(sp.socketId);
          if (!audio) {
            audio = document.createElement('audio');
            audio.autoplay = true;
            audio.setAttribute('playsinline', 'true');
            audio.style.display = 'none';
            document.body.appendChild(audio);
            audioElementsRef.current.set(sp.socketId, audio);
          }
          audio.srcObject = remoteStream;
          audio.play().catch(e => console.warn('Playback blocked by browser autoplay policy', e));
        };

        peerConnectionsRef.current.set(sp.socketId, pc);

        // Tell speaker we are ready to receive
        socket.emit('voice-signal', {
          targetSocketId: sp.socketId,
          signal: { type: 'initiate' }
        });
      }
    });
  }, [joinedUsers, socket]);

  // Clean up WebRTC fully on unmount
  React.useEffect(() => {
    return () => {
      stopLocalVoice();
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) audio.parentNode.removeChild(audio);
      });
      audioElementsRef.current.clear();
    };
  }, [stopLocalVoice]);
  
  // Math Plot state
  const [isMathModalVisible, setMathModalVisible] = useState(false);
  const [plotType, setPlotType] = useState<'linear' | 'quadratic' | 'sine'>('linear');
  const [coeffA, setCoeffA] = useState('1');
  const [coeffB, setCoeffB] = useState('0');
  const [coeffC, setCoeffC] = useState('0');

  // Sync canvas background switches
  const handleBackgroundChange = (type: 'grid' | 'blank' | 'coordinate') => {
    setBackgroundType(type);
    if (canvasRef.current) {
      // Background logic is handled reactively by the Whiteboard component's useEffect
    }
  };

  // Sync socket events from backend for graph drawer trigger
  useEffect(() => {
    if (!socket) return;
    
    socket.on('canvas-update-received', () => {
      // Handled by Whiteboard component
    });
  }, [socket]);

  // Leave room handler
  const handleExitClass = () => {
    if (window.confirm('Are you sure you want to leave this whiteboard session?')) {
      disconnectRoom();
      setView('dashboard');
    }
  };

  // Multi-board switcher
  const handleSwitchBoardLocal = (index: number) => {
    switchBoard(index);
  };

  // Draw graph trigger
  const handlePlotMath = () => {
    setMathModalVisible(false);
    if (canvasRef.current) {
      // Trigger canvas math drawing function using message style structure
      // @ts-ignore
      canvasRef.current.fire('drawMathFunction', {
        type: plotType,
        params: {
          a: parseFloat(coeffA) || 0,
          b: parseFloat(coeffB) || 0,
          c: parseFloat(coeffC) || 0
        }
      });
      
      // Let's implement drawing directly onto Fabric canvas for Web
      drawMathFunctionOnCanvas(canvasRef.current, plotType, {
        a: parseFloat(coeffA) || 0,
        b: parseFloat(coeffB) || 0,
        c: parseFloat(coeffC) || 0
      });
    }
  };

  const drawMathFunctionOnCanvas = (canvas: fabric.Canvas, type: string, params: any) => {
    if (useStore.getState().backgroundType !== 'coordinate') {
      handleBackgroundChange('coordinate');
    }

    const zoom = canvas.getZoom() || 1;
    const centerX = (canvas.getWidth() / zoom) / 2;
    const centerY = (canvas.getHeight() / zoom) / 2;
    const step = 2; 
    const scale = 40; // 40px = 1 mathematical unit
    const points: { x: number, y: number }[] = [];

    const a = params.a;
    const b = params.b;
    const c = params.c;

    for (let px = -centerX; px < centerX; px += step) {
      const x = px / scale;
      let y = 0;

      if (type === 'linear') {
        y = a * x + b;
      } else if (type === 'quadratic') {
        y = a * x * x + b * x + c;
      } else if (type === 'sine') {
        y = a * Math.sin(b * x + c);
      }

      const py = centerY - (y * scale);
      if (py >= 0 && py <= (canvas.getHeight() / zoom)) {
        points.push({ x: px + centerX, y: py });
      }
    }

    if (points.length < 2) return;

    let pathStr = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathStr += ` L ${points[i].x} ${points[i].y}`;
    }

    const pathObj = new fabric.Path(pathStr, {
      stroke: '#14b8a6',
      strokeWidth: 3,
      fill: 'transparent',
      selectable: true,
      borderColor: '#38bdf8',
      // @ts-ignore
      id: Math.random().toString(36).substr(2, 9)
    });

    canvas.add(pathObj);
    canvas.setActiveObject(pathObj);
    canvas.renderAll();
    
    // Save to sync
    // @ts-ignore
    canvas.fire('object:added', { target: pathObj });
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handleSendQuestion = () => {
    if (!questionInput.trim()) return;
    submitQuestion(questionInput);
    setQuestionInput('');
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-slate-950 overflow-hidden select-none relative">
      {/* Top Header navbar */}
      {/* Top Header navbar */}
      <header className="h-auto md:h-14 bg-slate-900 border-b border-white/5 flex flex-col md:flex-row items-center justify-between p-2.5 md:px-4 gap-2 md:gap-0 z-[200]">
        {/* Left header / Row 1 on mobile */}
        <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-3">
            <button
              onClick={handleExitClass}
              className="h-10 md:h-9 px-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow flex-shrink-0 flex items-center justify-center"
            >
              Leave
            </button>
            <div className="bg-slate-800 border border-white/5 rounded-xl px-2.5 h-10 md:h-9 text-xs font-bold text-slate-300 flex-shrink-0 flex items-center justify-center">
              <span className="md:inline hidden">Room Code: </span><span className="text-teal-400 font-mono tracking-wider">{roomCode}</span>
            </div>

            {/* Voice Broadcast Controls */}
            <button
              onClick={handleToggleVoiceBroadcast}
              className={`flex items-center gap-1.5 px-3.5 h-10 md:h-9 rounded-xl text-xs font-bold transition-all shadow ${
                isBroadcastingVoice
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700/80 border border-white/10 text-teal-400'
              }`}
            >
              {isBroadcastingVoice ? <Mic size={14} /> : <MicOff size={14} />}
              <span className="hidden sm:inline">{isBroadcastingVoice ? 'Mute Mic' : 'Unmute Mic'}</span>
            </button>

            {/* Voice Error Notification */}
            {voiceError && (
              <div className="text-[9px] md:text-[10px] text-red-400 font-semibold bg-red-950/20 border border-red-500/20 rounded-lg px-2 py-1 max-w-[80px] sm:max-w-[150px] md:max-w-[200px] truncate">
                Mic Error: {voiceError}
              </div>
            )}
          </div>

        </div>

        {/* Multi Board / Background select / Row 2 on mobile */}
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3 md:gap-4">
          {/* Multi Board index toggler */}
          {user?.role === 'teacher' ? (
            <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/5 text-[10px] md:text-[11px] font-semibold text-slate-400">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => handleSwitchBoardLocal(idx)}
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md transition-all ${
                    activeBoardIndex === idx ? 'bg-primary text-white shadow font-bold' : 'hover:text-slate-200'
                  }`}
                >
                  <span className="hidden md:inline">Board {idx + 1}</span>
                  <span className="inline md:hidden">B{idx + 1}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 border border-white/5 rounded-xl px-3 h-10 md:h-9 text-xs font-bold text-slate-300 flex items-center justify-center">
              Active: Board {activeBoardIndex + 1}
            </div>
          )}

          {/* Board Background select & desktop widget controls */}
          <div className="flex items-center gap-2">
            {/* Mobile Calculator trigger */}
            <button
              onClick={() => setCalcVisible(!isCalcVisible)}
              className={`md:hidden p-1.5 rounded-lg border transition-all ${
                isCalcVisible ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-slate-800 border-white/10 text-slate-300'
              }`}
              title="Scientific Calculator"
            >
              <CalcIcon size={13} />
            </button>

            {user?.role === 'teacher' && (
              <>
                <select
                  value={backgroundType}
                  onChange={(e) => handleBackgroundChange(e.target.value as any)}
                  className="bg-slate-800 border border-white/10 text-[10px] md:text-xs text-slate-300 rounded-lg px-2 py-1 md:py-1.5 outline-none focus:border-primary/50 max-w-[80px] md:max-w-none"
                >
                  <option value="grid">Grid</option>
                  <option value="blank">Blank</option>
                  <option value="coordinate">Axes</option>
                </select>

                <button
                  onClick={() => setMathModalVisible(true)}
                  className="h-7 md:h-8 px-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-[10px] md:text-xs font-bold rounded-lg transition-all shadow flex items-center justify-center gap-1 flex-shrink-0"
                >
                  <Plus size={12} />
                  <span className="hidden sm:inline">Plot Graph</span>
                  <span className="inline sm:hidden">Plot</span>
                </button>
              </>
            )}

            {/* Desktop-only Widget controllers */}
            <div className="hidden md:flex gap-2">
              <button
                onClick={() => setCalcVisible(!isCalcVisible)}
                className={`p-2 rounded-lg border transition-all ${
                  isCalcVisible ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
                }`}
                title="Scientific Calculator"
              >
                <CalcIcon size={16} />
              </button>
              <button
                onClick={() => setAIPanelVisible(!isAIPanelVisible)}
                className={`p-2 rounded-lg border transition-all ${
                  isAIPanelVisible ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
                }`}
                title="AI Assistant"
              >
                <Brain size={16} />
              </button>
              <button
                onClick={() => setRosterVisible(!isRosterVisible)}
                className={`p-2 rounded-lg border transition-all ${
                  isRosterVisible ? 'bg-primary/10 border-primary/30 text-primary-light' : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
                }`}
                title="Classroom Sidebar"
              >
                <Users size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace panel */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Fabric drawing board */}
        <Whiteboard canvasRef={canvasRef} />



        {/* Floating draggable widgets */}
        <Calculator />

        {/* AI chat assistant panel */}
        <AIAssistant />

        {/* Roster & Collaboration sidebar */}
        {isRosterVisible && (
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-72 bg-slate-900/98 backdrop-blur border-l border-white/10 flex flex-col z-[500] shadow-2xl">
            {/* Header */}
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4">
              <span className="text-slate-200 text-sm font-bold">
                {isMobile && activeMobileTab === 'chat' ? 'Class Chat' : 'Classroom Activity'}
              </span>
              <button
                onClick={() => {
                  setRosterVisible(false);
                  setActiveMobileTab('board');
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Attendance scroll roster */}
            <div className={`flex-grow p-4 flex flex-col scrollbar-thin ${isMobile ? 'h-full overflow-hidden' : 'flex-1 overflow-y-auto gap-4'}`}>
              
              {/* Roster Panel (Active members & Questions) */}
              {(!isMobile || activeMobileTab === 'roster') && (
                <div className="flex-1 overflow-y-auto flex flex-col gap-4 scrollbar-thin">
                  {/* Users list */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">Active Members ({joinedUsers.length})</span>
                    <div className="flex flex-col gap-1.5 mt-2">
                      {joinedUsers.map((u) => (
                        <div key={u.socketId} className="flex flex-col border-b border-white/5 py-2">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${u.role === 'teacher' ? 'bg-sky-400' : 'bg-green-400'}`} />
                              <span className="text-slate-300 font-medium">{u.name} {u.role === 'teacher' ? '(Teacher)' : ''}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {u.handRaised && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[9px] font-bold">
                                  <Hand size={8} /> Hand
                                </span>
                              )}
                              {u.isSpeaking && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded text-[9px] font-bold animate-pulse">
                                  <Volume2 size={8} /> Voice Live
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hand raise for students */}
                  {user?.role === 'student' && (
                    <button
                      onClick={toggleHandRaise}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow"
                    >
                      <Hand size={14} /> Toggle Hand Raise
                    </button>
                  )}

                  {/* Questions Panel */}
                  <div className="border-t border-white/5 pt-3">
                    <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">Student Questions</span>
                    <div className="flex flex-col gap-2 mt-2">
                      {questions.filter((q) => !q.resolved).map((q) => (
                        <div key={q.id} className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-sky-400 font-bold">{q.studentName}</span>
                            {user?.role === 'teacher' && (
                              <button
                                onClick={() => resolveQuestion(q.id)}
                                className="text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                              >
                                <CheckCircle size={10} /> Resolve
                              </button>
                            )}
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed">{q.content}</p>
                        </div>
                      ))}
                    </div>

                    {/* Ask question input */}
                    {user?.role === 'student' && (
                      <div className="flex gap-1.5 mt-2 flex-shrink-0">
                        <input
                          type="text"
                          value={questionInput}
                          onChange={(e) => setQuestionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendQuestion()}
                          placeholder="Ask the instructor..."
                          className="flex-1 h-11 md:h-8 bg-black/40 border border-white/10 rounded-xl md:rounded-lg px-3.5 md:px-2.5 text-sm md:text-xs text-white outline-none focus:border-teal-500/50"
                        />
                        <button
                          onClick={handleSendQuestion}
                          className="w-11 h-11 md:w-8 md:h-8 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl md:rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Panel */}
              {(!isMobile || activeMobileTab === 'chat') && (
                <div className={`flex flex-col ${isMobile ? 'flex-1 h-full overflow-hidden' : 'border-t border-white/5 pt-3 min-h-[160px]'}`}>
                  <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">Class Chat</span>
                  <div className={`flex-1 bg-black/30 border border-white/5 rounded-xl p-2 mt-2 overflow-y-auto text-[11px] leading-relaxed flex flex-col gap-1.5 ${isMobile ? 'h-auto' : 'max-h-[150px]'}`}>
                    {chatHistory.map((c) => (
                      <div key={c.id}>
                        <span className={`font-bold ${c.role === 'teacher' ? 'text-red-400' : 'text-slate-400'}`}>{c.sender}: </span>
                        <span className="text-slate-300">{c.message}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5 mt-2 flex-shrink-0">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Type message..."
                      className="flex-1 h-11 md:h-8 bg-black/40 border border-white/10 rounded-xl md:rounded-lg px-3.5 md:px-2.5 text-sm md:text-xs text-white outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={handleSendChat}
                      className="w-11 h-11 md:w-8 md:h-8 bg-primary hover:bg-primary-light text-white rounded-xl md:rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Coordinate plotting modal popup form */}
      {isMathModalVisible && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[2000]">
          <div className="w-80 bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
            <span className="text-slate-200 text-sm font-bold text-center">Function Graph Plotter</span>
            
            {/* Tabs */}
            <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/5 text-[10px] font-semibold text-slate-400">
              {(['linear', 'quadratic', 'sine'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPlotType(type)}
                  className={`flex-1 py-1 rounded-md text-center transition-all ${
                    plotType === type ? 'bg-teal-500 text-slate-950 shadow font-bold' : 'hover:text-slate-200'
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-2.5">
              {plotType === 'linear' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-teal-400 text-center font-semibold">y = ax + b</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Slope (a):</span>
                    <input type="number" value={coeffA} onChange={(e) => setCoeffA(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Y-intercept (b):</span>
                    <input type="number" value={coeffB} onChange={(e) => setCoeffB(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                </div>
              )}

              {plotType === 'quadratic' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-teal-400 text-center font-semibold">y = ax² + bx + c</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">a =</span>
                    <input type="number" value={coeffA} onChange={(e) => setCoeffA(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">b =</span>
                    <input type="number" value={coeffB} onChange={(e) => setCoeffB(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">c =</span>
                    <input type="number" value={coeffC} onChange={(e) => setCoeffC(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                </div>
              )}

              {plotType === 'sine' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-teal-400 text-center font-semibold">y = a · sin(bx + c)</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Amplitude (a):</span>
                    <input type="number" value={coeffA} onChange={(e) => setCoeffA(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Frequency (b):</span>
                    <input type="number" value={coeffB} onChange={(e) => setCoeffB(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Phase shift (c):</span>
                    <input type="number" value={coeffC} onChange={(e) => setCoeffC(e.target.value)} className="w-24 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-white text-xs outline-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3 mt-2 text-xs font-semibold">
              <button
                onClick={() => setMathModalVisible(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700/80 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handlePlotMath}
                className="flex-1 py-2 bg-teal-500 text-slate-950 rounded-lg hover:bg-teal-400 transition-all font-bold"
              >
                Draw Graph
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar for mobile */}
      {isMobile && (
        <div className="h-16 bg-slate-900 border-t border-white/5 flex justify-around items-center px-4 z-[400] flex-shrink-0 select-none">
          <button
            onClick={() => handleMobileTabChange('board')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeMobileTab === 'board' ? 'text-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PenTool size={18} />
            <span className="text-[10px] font-bold">Board</span>
          </button>

          <button
            onClick={() => handleMobileTabChange('chat')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeMobileTab === 'chat' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={18} />
            <span className="text-[10px] font-bold">Chat</span>
          </button>

          <button
            onClick={() => handleMobileTabChange('roster')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeMobileTab === 'roster' ? 'text-amber-500' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={18} />
            <span className="text-[10px] font-bold">Roster</span>
          </button>

          <button
            onClick={() => handleMobileTabChange('ai')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeMobileTab === 'ai' ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain size={18} />
            <span className="text-[10px] font-bold">AI Helper</span>
          </button>
        </div>
      )}
    </div>
  );
}
