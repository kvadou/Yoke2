const PORT = process.env.PORT || 3000;

const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");

//Set up Express server with socket.io
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Requiring our models for syncing
const db = require("../Yoke2/models");

//Require functions for socket.io
const formatMessage = require("./public/assets/js/messages.js");
const {
  userJoin,
  getCurrentUser,
  userLeaves,
  getRoomUsers,
} = require("./public/assets/js/users.js");

//Serve static content for app from public directory
app.use(express.static(path.join(__dirname, "public")));

//Set up handlebars
app.engine(
  "handlebars",
  exphbs({
    extname: "handlebars",
    defaultLayout: "main",
    layoutsDir: __dirname + "/views/layouts",
  })
);
app.set("view engine", "handlebars");

require("./controllers/index")(app);
// Import routes and give the server access to them.
//let routes = require("./controllers/index.js");
//app.use(routes);

//When we emit messages to the user they'll come from Admin - this sets that variable
const admin = "admin";

//Run socket when client connects - communicates with CHAT.JS FILE
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    //Use userJoin function
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);

    //Send message to user when they join the room
    socket.emit("message", formatMessage(admin, "Welcome to YOKE!"));

    //Broadcast to everyone EXCEPT user that they've entered the room
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(admin, `${user.username} has joined the chat!`)
      );

    //Send User and Room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  //Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  //When client disconnects
  socket.on("disconnect", () => {
    const user = userLeaves(socket.id);
    if (user) {
      //Messages the room when a user leave the chat
      io.to(user.room).emit(
        "message",
        formatMessage(admin, `${user.username} has left the chat!`)
      );

      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// Syncing our sequelize models and then starting our Express app
// =============================================================
db.sequelize.sync().then(function () {
  server.listen(PORT, function () {
    console.log("Server listening on: http://localhost:" + PORT);
  });
});
