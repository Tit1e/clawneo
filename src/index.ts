import { runApp } from "./app.js";

runApp().catch((error: unknown) => {
  console.error("ClawNeo failed to start.");
  console.error(error);
  process.exitCode = 1;
});
