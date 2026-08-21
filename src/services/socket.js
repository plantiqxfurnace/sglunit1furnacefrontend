import { io } from "socket.io-client";
import { api } from "./api";

export const connectSocket = () =>
  io(api.baseUrl || window.location.origin, {
    transports: ["websocket", "polling"]
  });
