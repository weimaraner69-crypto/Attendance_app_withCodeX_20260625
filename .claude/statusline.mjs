// Claude Code のステータスラインにコンテキスト使用率を表示するスクリプト。
// 80% 超で黄色、90% 超で赤色にする。
import { stdin } from "node:process";

let raw = "";
stdin.setEncoding("utf8");
stdin.on("data", (chunk) => (raw += chunk));
stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    // 入力が壊れていても表示は継続する
  }

  const ctx = data.context_window ?? {};
  let pct = ctx.used_percentage;
  if (typeof pct !== "number") {
    const usage = ctx.current_usage;
    const size = ctx.context_window_size;
    if (usage && size) {
      const used =
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
      pct = (used / size) * 100;
    } else {
      pct = 0;
    }
  }

  const RESET = "\x1b[0m";
  const YELLOW = "\x1b[33m";
  const RED = "\x1b[31m";
  const color = pct > 90 ? RED : pct > 80 ? YELLOW : "";

  const model = data.model?.display_name ?? "";
  const label = `コンテキスト: ${Math.round(pct)}%`;
  const prefix = model ? `[${model}] ` : "";
  process.stdout.write(prefix + (color ? `${color}${label}${RESET}` : label));
});
