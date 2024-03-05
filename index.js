const express = require("express");
const http = require("http");
const app = express();
const port = 5000;
let server = http.createServer(app);
const cors = require("cors");
const { nanoid } = require("nanoid");
const path = require("path");
require("dotenv").config();

app.use(cors());
app.use(express.json());

const io = require("socket.io")(server, {
  cors: {
    origin: process.env.NODE_ENV === "development" ? "http://localhost:5173":"https://tictactoe-vqwd.onrender.com/",
  },
});
// io.origins('*:*')
app.use(express.static(path.join(__dirname, "/client/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/client/dist/index.html"));
});
const users = new Map();

io.on("connection", (socket) => {
  console.log("socket connected " + socket.id);
  socket.on("createRoom", (data) => {
    try {
      const { name, id } = data;
      let player = {
        name,
        playerType: "X",
        id: nanoid(),
        socketID: socket.id,
      };
      const room = {
        occupancy: 1,
        players: [player],
        isJoin: true,
        turn: player.socketID,
        turnIndex: 0,
        id: id,
      };
      users.set(id, room);
      socket.join(id);
      io.to(id).emit("createRoomSuccess", room);
    } catch (error) {
      console.log(error);
    }
  });
  socket.on("joinRoom", (data) => {
    const { name, id } = data;
    const room = users.get(id);
    if (!room) {
      io.to(socket.id).emit("notfound", room);
      return;
    }
    if (room.isJoin) {
      let player = {
        name,
        playerType: "O",
        id: nanoid(),
        socketID: socket.id,
      };
      room.players.push(player);
      socket.join(id);
      room.isJoin = false;
      room.occupancy = 2;
      io.to(id).emit("joinRoomSuccess", room);
      // io.to(id).emit("updatePlayers", room.players);
      io.to(id).emit("roomupdate", { room });
    }
  });
  socket.on("tap", (data) => {
    const { id, index, boardData } = data;
    const room = users.get(id);
    const player = room.players[room.turnIndex];
    if (room.turnIndex === 0) {
      room.turn = room.players[1].socketID;
      room.turnIndex = 1;
      io.to(room.players[1].socketID).emit("tapped", {
        index,
        choice: player.playerType,
        boardData,
      });
    } else {
      room.turn = room.players[0].socketID;
      room.turnIndex = 0;
      io.to(room.players[0].socketID).emit("tapped", {
        index,
        choice: player.playerType,
        boardData,
      });
    }
    io.to(id).emit("roomupdate", { room });
  });
  socket.on("exit", (data) => {
    const { id } = data;
    const room = users.get(id);
    if (room) {
      const newPlayers = room.players.filter(
        (player) => player.socketID !== socket.id
      );
      room.players = newPlayers;
      room.isJoin = true;
      room.turnIndex = 0;
      room.players[0].playerType = "X";
      io.to(room.players[0].socketID).emit("playerLeave", room);
    }
  });
  socket.on("requesttoplayagain", (data) => {
    const { id } = data;
    const room = users.get(id);
    if (room) {
      const playerIndex = room.players.findIndex(
        (player) => player.socketID === socket.id
      );
      if (playerIndex === 0) {
        io.to(room.players[1].socketID).emit(
          "requesttoplayagainfromuser",
          room
        );
      } else {
        io.to(room.players[0].socketID).emit(
          "requesttoplayagainfromuser",
          room
        );
      }
    }
  });
  socket.on("acceptrequest", (data) => {
    const { id } = data;
    const room = users.get(id);
    if (room) {
      const playerIndex = room.players.findIndex(
        (player) => player.socketID === socket.id
      );
      room.isJoin = false;
      room.turnIndex = 0;
      if (playerIndex === 0) {
        io.to(room.players[1].socketID).emit("acceptrequestfromuser", room);
        room.turnIndex = 0;
      } else {
        io.to(room.players[0].socketID).emit("acceptrequestfromuser", room);
        room.turnIndex = 1;
      }
      io.to(id).emit("newgame", room);
    }
  });
  socket.on("sendMessage", (data) => {
    const { id, message, userid } = data;
    const room = users.get(id);
    if (room) {
      const playerIndex = room.players.findIndex(
        (player) => player.socketID === socket.id
      );
      if (playerIndex === 0) {
        io.to(room.players[1].socketID).emit("receiveMessage", {
          message,
          id: userid,
        });
      } else {
        io.to(room.players[0].socketID).emit("receiveMessage", {
          message,
          id: userid,
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    console.log(users);
    console.log(socket.id);

    //    const room = Ob
    //     const room = users.get()

    // rooms.forEach((roomName) => {
    //   // Remove the user from the room's user list
    //   if (roomUsers.has(roomName)) {
    //     const usersInRoom = roomUsers
    //       .get(roomName)
    //       .filter((user) => user.socketId !== socket.id);
    //     roomUsers.set(roomName, usersInRoom);
    //     // Optionally, broadcast the updated user list to all users in the room
    //     io.to(roomName).emit("userListUpdated", usersInRoom);
    //   }
    // });

    // Iterate through all rooms and decrement occupancy if the user was in them
    // roomOccupancy.forEach((occupants, roomName) => {
    //   if (socket.rooms.has(roomName)) {
    //     roomOccupancy.set(roomName, occupants - 1);
    //   }
    // });
  });
});

server.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
