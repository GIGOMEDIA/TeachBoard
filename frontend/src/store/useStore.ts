import { create } from 'zustand';
import io from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (
  window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`
);

interface User {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
}

interface ChatMessage {
  id: string;
  sender: string;
  role: string;
  message: string;
  createdAt: string;
}

interface Question {
  id: string;
  studentName: string;
  content: string;
  resolved: boolean;
  createdAt: string;
}

interface JoinedUser {
  socketId: string;
  userId: string;
  name: string;
  role: 'teacher' | 'student';
  handRaised: boolean;
  isSpeaking: boolean;
  requestToSpeak: boolean;
}

interface TeachBoardState {
  // Auth
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;

  // Socket sync
  socket: any | null;
  roomCode: string | null;
  isConnected: boolean;
  joinedUsers: JoinedUser[];
  chatHistory: ChatMessage[];
  questions: Question[];
  connectRoom: (roomCode: string) => void;
  disconnectRoom: () => void;
  sendChatMessage: (text: string) => void;
  toggleHandRaise: () => void;
  submitQuestion: (text: string) => void;
  resolveQuestion: (id: string) => void;

  // Canvas settings
  currentTool: string;
  currentColor: string;
  currentStrokeWidth: number;
  backgroundType: 'grid' | 'blank' | 'coordinate';
  boards: string[]; // Serialized state for Board 1, 2, 3
  activeBoardIndex: number;
  setTool: (tool: string) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setBackgroundType: (type: 'grid' | 'blank' | 'coordinate') => void;
  saveActiveBoardData: (jsonStr: string) => void;
  switchBoard: (index: number) => void;

  // Calculator
  isCalcVisible: boolean;
  isCalcMinimized: boolean;
  isCalcPinned: boolean;
  calcPosition: { x: number; y: number };
  setCalcVisible: (visible: boolean) => void;
  setCalcMinimized: (minimized: boolean) => void;
  setCalcPinned: (pinned: boolean) => void;
  setCalcPosition: (pos: { x: number; y: number }) => void;

  // AI Assistant
  isAIPanelVisible: boolean;
  aiChatMessages: { sender: 'user' | 'ai'; text: string; type?: 'text' | 'quiz'; quizData?: any }[];
  aiLoading: boolean;
  setAIPanelVisible: (visible: boolean) => void;
  sendToAI: (action: string, topic: string, context?: string) => Promise<void>;
  clearAIChat: () => void;

  // Voice actions
  startVoiceBroadcast: () => void;
  stopVoiceBroadcast: () => void;
  requestSpeak: () => void;
  cancelRequestSpeak: () => void;
  approveSpeakRequest: (studentSocketId: string) => void;
  rejectSpeakRequest: (studentSocketId: string) => void;
  revokeSpeak: (studentSocketId: string) => void;
}

export const useStore = create<TeachBoardState>((set, get) => ({
  // Auth
  token: localStorage.getItem('token'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    get().disconnectRoom();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },

  // Socket
  socket: null,
  roomCode: null,
  isConnected: false,
  joinedUsers: [],
  chatHistory: [],
  questions: [],

  connectRoom: (roomCode) => {
    const { user, socket } = get();
    if (!user) return;
    if (socket) socket.disconnect();

    const cleanCode = roomCode.toUpperCase();
    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      set({ isConnected: true, roomCode: cleanCode });
      newSocket.emit('join-room', { roomCode: cleanCode, user });
    });

    newSocket.on('room-users', (users: JoinedUser[]) => {
      set({ joinedUsers: users });
    });

    newSocket.on('chat-message-received', (msg: ChatMessage) => {
      set((state) => ({ chatHistory: [...state.chatHistory, msg] }));
    });

    newSocket.on('question-received', (q: Question) => {
      set((state) => ({ questions: [...state.questions, q] }));
    });

    newSocket.on('question-resolved', (qId: string) => {
      set((state) => ({
        questions: state.questions.map((q) => (q.id === qId ? { ...q, resolved: true } : q)),
      }));
    });

    newSocket.on('canvas-board-switch-received', (boardIndex: number) => {
      set({ activeBoardIndex: boardIndex });
    });

    newSocket.on('disconnect', () => {
      set({ isConnected: false, roomCode: null, joinedUsers: [], chatHistory: [], questions: [] });
    });

    set({ socket: newSocket });
  },

  disconnectRoom: () => {
    const { socket } = get();
    if (socket) socket.disconnect();
    set({ socket: null, roomCode: null, isConnected: false, joinedUsers: [], chatHistory: [], questions: [] });
  },

  sendChatMessage: (text) => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('chat-message', text);
  },

  toggleHandRaise: () => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('hand-raise-toggle');
  },

  submitQuestion: (text) => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('submit-question', text);
  },

  resolveQuestion: (id) => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('resolve-question', id);
  },

  startVoiceBroadcast: () => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-start-broadcast');
  },

  stopVoiceBroadcast: () => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-stop-broadcast');
  },

  requestSpeak: () => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-request-speak');
  },

  cancelRequestSpeak: () => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-cancel-speak');
  },

  approveSpeakRequest: (studentSocketId) => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-approve-request', studentSocketId);
  },

  rejectSpeakRequest: (studentSocketId) => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-reject-request', studentSocketId);
  },

  revokeSpeak: (studentSocketId) => {
    const { socket, isConnected } = get();
    if (isConnected && socket) socket.emit('voice-revoke-speak', studentSocketId);
  },

  // Whiteboard drawing setting state
  currentTool: 'pencil',
  currentColor: '#2563EB',
  currentStrokeWidth: 4,
  backgroundType: 'grid',
  boards: ['', '', ''],
  activeBoardIndex: 0,

  setTool: (tool) => set({ currentTool: tool }),
  setColor: (color) => set({ currentColor: color }),
  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
  setBackgroundType: (type) => set({ backgroundType: type }),
  
  saveActiveBoardData: (jsonStr) => {
    set((state) => {
      const updatedBoards = [...state.boards];
      updatedBoards[state.activeBoardIndex] = jsonStr;
      return { boards: updatedBoards };
    });
  },

  switchBoard: (index) => {
    const { socket, isConnected } = get();
    set({ activeBoardIndex: index });
    if (isConnected && socket) {
      socket.emit('canvas-board-switch', index);
    }
  },

  // Draggable Calculator panel states
  isCalcVisible: false,
  isCalcMinimized: false,
  isCalcPinned: false,
  calcPosition: { x: window.innerWidth / 3, y: 150 },
  setCalcVisible: (visible) => set({ isCalcVisible: visible }),
  setCalcMinimized: (minimized) => set({ isCalcMinimized: minimized }),
  setCalcPinned: (pinned) => set({ isCalcPinned: pinned }),
  setCalcPosition: (pos) => set({ calcPosition: pos }),

  // AI chat states
  isAIPanelVisible: false,
  aiChatMessages: [
    { sender: 'ai', text: 'Hello! I am your AI Teaching Assistant. I can help solve equations, generate quizzes, explain concepts, and draft practice questions. Try asking below!' }
  ],
  aiLoading: false,
  setAIPanelVisible: (visible) => set({ isAIPanelVisible: visible }),

  sendToAI: async (action, topic, context) => {
    const { token } = get();
    if (!token) return;

    set({ aiLoading: true });
    
    let userMsg = '';
    switch (action) {
      case 'solve': userMsg = `Solve: ${topic}`; break;
      case 'quiz': userMsg = `Generate a quiz on: ${topic}`; break;
      case 'examples': userMsg = `Real-world examples of: ${topic}`; break;
      case 'summarize': userMsg = `Summarize: ${topic}`; break;
      case 'explain': userMsg = `Explain: ${topic}`; break;
      case 'practice': userMsg = `Practice questions for: ${topic}`; break;
      default: userMsg = topic;
    }

    set((state) => ({
      aiChatMessages: [...state.aiChatMessages, { sender: 'user', text: userMsg }]
    }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, topic, context })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          get().logout();
        }
        throw new Error('AI assistant response failure');
      }

      const resData = await response.json();
      
      set((state) => ({
        aiChatMessages: [
          ...state.aiChatMessages,
          {
            sender: 'ai',
            text: resData.type === 'quiz' ? 'Here is a quiz for you:' : resData.content,
            type: resData.type,
            quizData: resData.type === 'quiz' ? resData.content : null
          }
        ]
      }));
    } catch (err: any) {
      console.error(err);
      set((state) => ({
        aiChatMessages: [...state.aiChatMessages, { sender: 'ai', text: `Sorry, I failed to complete the request: ${err.message}` }]
      }));
    } finally {
      set({ aiLoading: false });
    }
  },

  clearAIChat: () => set({
    aiChatMessages: [
      { sender: 'ai', text: 'Hello! I am your AI Teaching Assistant. Ask me to solve equations, explain formulas, or generate quizzes.' }
    ]
  })
}));
