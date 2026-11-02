// Minimal client for the RevitMcp bridge on 127.0.0.1:48884.
import net from "node:net";

export function call(command, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: 48884 });
    const chunks = [];
    socket.setTimeout(280000, () => { socket.destroy(); reject(new Error("timeout: " + command)); });
    socket.on("connect", () => socket.write(JSON.stringify({ command, params }) + "\n"));
    socket.on("data", (c) => chunks.push(c));
    socket.on("error", reject);
    socket.on("end", () => {
      socket.destroy();
      try {
        const r = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (r.ok) resolve(r.result); else reject(new Error(r.error));
      } catch { reject(new Error("bad response: " + command)); }
    });
  });
}
