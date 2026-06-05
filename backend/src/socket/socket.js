// Socket.io handlers for real-time collaboration

// Keep track of active users in memory for quick synchronization
// Map of roomCode -> Array of user objects { socketId, userId, name, role, handRaised }
const roomUsers = new Map();

export const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket Connected: ${socket.id}`);

    // Join Classroom Room
    socket.on('join-room', ({ roomCode, user }) => {
      if (!roomCode || !user) return;
      
      const cleanCode = roomCode.toUpperCase();
      socket.join(cleanCode);
      socket.roomCode = cleanCode;
      socket.userProfile = {
        socketId: socket.id,
        userId: user.id || socket.id,
        name: user.name || 'Anonymous',
        role: user.role || 'student',
        handRaised: false,
        isSpeaking: false,
        requestToSpeak: false
      };

      // Add user to room list
      if (!roomUsers.has(cleanCode)) {
        roomUsers.set(cleanCode, []);
      }
      roomUsers.get(cleanCode).push(socket.userProfile);

      console.log(`User ${user.name} (${user.role}) joined room ${cleanCode}`);

      // Broadcast updated roster to room
      io.to(cleanCode).emit('room-users', roomUsers.get(cleanCode));
      
      // Let existing users know someone joined
      socket.to(cleanCode).emit('user-joined', socket.userProfile);
    });

    // Broadcast whiteboard drawing operations
    socket.on('canvas-update', (data) => {
      // data contains: { action: 'add'|'modify'|'remove', object: fabricJSON, id: uniqueObjId }
      if (socket.roomCode) {
        socket.to(socket.roomCode).emit('canvas-update-received', data);
      }
    });

    // Broadcast real-time freehand drawing pointer coordinates
    socket.on('draw-pointer', (data) => {
      if (socket.roomCode) {
        socket.to(socket.roomCode).emit('draw-pointer-received', data);
      }
    });

    // Broadcast canvas clear
    socket.on('canvas-clear', () => {
      if (socket.roomCode) {
        socket.to(socket.roomCode).emit('canvas-clear-received');
      }
    });

    // Broadcast board/slide page switch
    socket.on('canvas-board-switch', (boardIndex) => {
      if (socket.roomCode) {
        socket.to(socket.roomCode).emit('canvas-board-switch-received', boardIndex);
      }
    });

    // Broadcast cursor movements for real-time cursor viewing
    socket.on('cursor-move', (coords) => {
      // coords contains { x, y }
      if (socket.roomCode && socket.userProfile) {
        socket.to(socket.roomCode).emit('cursor-move-received', {
          socketId: socket.id,
          name: socket.userProfile.name,
          role: socket.userProfile.role,
          x: coords.x,
          y: coords.y
        });
      }
    });

    // Toggle hand raising for students
    socket.on('hand-raise-toggle', () => {
      if (socket.roomCode && socket.userProfile) {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === socket.id);
        if (user) {
          user.handRaised = !user.handRaised;
          io.to(socket.roomCode).emit('room-users', users);
        }
      }
    });

    // Voice broadcasting actions
    socket.on('voice-start-broadcast', () => {
      if (socket.roomCode && socket.userProfile) {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === socket.id);
        if (user) {
          user.isSpeaking = true;
          io.to(socket.roomCode).emit('room-users', users);
        }
      }
    });

    socket.on('voice-stop-broadcast', () => {
      if (socket.roomCode && socket.userProfile) {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === socket.id);
        if (user) {
          user.isSpeaking = false;
          io.to(socket.roomCode).emit('room-users', users);
        }
      }
    });

    socket.on('voice-request-speak', () => {
      if (socket.roomCode && socket.userProfile) {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === socket.id);
        if (user) {
          user.requestToSpeak = true;
          io.to(socket.roomCode).emit('room-users', users);
        }
      }
    });

    socket.on('voice-cancel-speak', () => {
      if (socket.roomCode && socket.userProfile) {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === socket.id);
        if (user) {
          user.requestToSpeak = false;
          io.to(socket.roomCode).emit('room-users', users);
        }
      }
    });

    socket.on('voice-approve-request', (targetSocketId) => {
      if (socket.roomCode && socket.userProfile && socket.userProfile.role === 'teacher') {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === targetSocketId);
        if (user) {
          user.requestToSpeak = false;
          io.to(socket.roomCode).emit('room-users', users);
          io.to(targetSocketId).emit('voice-approved');
        }
      }
    });

    socket.on('voice-reject-request', (targetSocketId) => {
      if (socket.roomCode && socket.userProfile && socket.userProfile.role === 'teacher') {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === targetSocketId);
        if (user) {
          user.requestToSpeak = false;
          io.to(socket.roomCode).emit('room-users', users);
          io.to(targetSocketId).emit('voice-rejected');
        }
      }
    });

    socket.on('voice-revoke-speak', (targetSocketId) => {
      if (socket.roomCode && socket.userProfile && socket.userProfile.role === 'teacher') {
        const users = roomUsers.get(socket.roomCode) || [];
        const user = users.find(u => u.socketId === targetSocketId);
        if (user) {
          user.requestToSpeak = false;
          user.isSpeaking = false;
          io.to(socket.roomCode).emit('room-users', users);
          io.to(targetSocketId).emit('voice-revoked');
        }
      }
    });

    // Relay WebRTC signaling
    socket.on('voice-signal', ({ targetSocketId, signal }) => {
      io.to(targetSocketId).emit('voice-signal-received', {
        senderSocketId: socket.id,
        signal
      });
    });

    // Submit a student question to the panel
    socket.on('submit-question', (questionText) => {
      if (socket.roomCode && socket.userProfile) {
        const question = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          studentName: socket.userProfile.name,
          content: questionText,
          resolved: false,
          createdAt: new Date().toISOString()
        };
        
        io.to(socket.roomCode).emit('question-received', question);
      }
    });

    // Resolve a student question
    socket.on('resolve-question', (questionId) => {
      if (socket.roomCode) {
        io.to(socket.roomCode).emit('question-resolved', questionId);
      }
    });

    // Broadcast real-time room chat messages
    socket.on('chat-message', (messageText) => {
      if (socket.roomCode && socket.userProfile) {
        const chatMsg = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          sender: socket.userProfile.name,
          role: socket.userProfile.role,
          message: messageText,
          createdAt: new Date().toISOString()
        };

        io.to(socket.roomCode).emit('chat-message-received', chatMsg);
      }
    });

    // Disconnect event
    socket.on('disconnect', () => {
      console.log(`Socket Disconnected: ${socket.id}`);
      if (socket.roomCode) {
        const users = roomUsers.get(socket.roomCode) || [];
        const remainingUsers = users.filter(u => u.socketId !== socket.id);
        
        if (remainingUsers.length === 0) {
          roomUsers.delete(socket.roomCode);
        } else {
          roomUsers.set(socket.roomCode, remainingUsers);
          io.to(socket.roomCode).emit('room-users', remainingUsers);
        }
        
        socket.to(socket.roomCode).emit('user-left', socket.id);
      }
    });
  });
};
