import { serve } from "bun";
import index from "./index.html";

const server = serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: false,
  },
});

console.log(`Bacom preview running at ${server.url}`);
