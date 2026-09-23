import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  // "server-only" เป็น marker ของ Next (มีแต่ตอน build) — vitest resolve ไม่เจอ
  // map ให้ว่างเปล่า เพื่อให้เทสต์ import โมดูลฝั่งเซิร์ฟเวอร์ที่เป็น pure logic ได้
  resolve: { alias: { "server-only": new URL("./test/server-only-stub.ts", import.meta.url).pathname } },
  test: {
    environment: "node",
    globals: true,
  },
})
