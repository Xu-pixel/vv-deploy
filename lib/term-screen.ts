/** Matches the pty given to docker compose so its redraw stays inside this screen. */
export const TERM_ROWS = 16;
export const TERM_COLS = 100;

type Row = string[];

function blank(cols: number): Row {
  return Array.from({ length: cols }, () => " ");
}

export class TermScreen {
  private rows: Row[];
  private row = 0;
  private col = 0;

  constructor(
    readonly height = TERM_ROWS,
    readonly width = TERM_COLS,
  ) {
    this.rows = Array.from({ length: height }, () => blank(width));
  }

  write(input: string): string {
    let scrolled = "";
    const chars = input.replace(/\u0004/g, "");
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i] ?? "";
      if (ch === "\r") {
        if (chars[i + 1] === "\n") i += 1;
        else {
          this.col = 0;
          continue;
        }
      }
      if (ch === "\n" || ch === "\r") {
        scrolled += this.newline();
        continue;
      }
      if (ch === "\b") {
        if (this.col > 0) this.col -= 1;
        continue;
      }
      if (ch === "\u001b") {
        i = this.escape(chars, i);
        continue;
      }
      if (ch < " " || ch === "\u007f") continue;
      scrolled += this.put(ch);
    }
    return scrolled;
  }

  visible(): string {
    const lines = this.rows.map((row) => row.join("").trimEnd());
    let end = lines.length;
    while (end > 0 && lines[end - 1] === "") end -= 1;
    if (end === 0) return "";
    return `${lines.slice(0, end).join("\n")}\n`;
  }

  statusLine(): string {
    const lines = this.visible().split("\n").map((line) => line.trim()).filter(Boolean);
    return lines[lines.length - 1] ?? "";
  }

  private put(ch: string): string {
    let scrolled = "";
    if (this.col >= this.width) scrolled = this.newline();
    this.rows[this.row]![this.col] = ch;
    this.col += 1;
    return scrolled;
  }

  private newline(): string {
    this.col = 0;
    this.row += 1;
    if (this.row < this.height) return "";
    const left = this.rows[0]!.join("").trimEnd();
    this.rows.shift();
    this.rows.push(blank(this.width));
    this.row = this.height - 1;
    return left ? `${left}\n` : "\n";
  }

  private escape(input: string, at: number): number {
    const next = input[at + 1];
    if (next === "]") {
      let i = at + 2;
      while (i < input.length && input[i] !== "\u0007" && input[i] !== "\n") {
        if (input[i] === "\u001b" && input[i + 1] === "\\") return i + 1;
        i += 1;
      }
      return i;
    }
    if (next !== "[") return at + (next ? 1 : 0);
    let i = at + 2;
    let args = "";
    while (i < input.length) {
      const c = input[i] ?? "";
      if ((c >= "0" && c <= "9") || c === ";" || c === "?") {
        args += c;
        i += 1;
        continue;
      }
      this.csi(c, args);
      return i;
    }
    return input.length - 1;
  }

  private csi(cmd: string, raw: string): void {
    const nums = raw
      .replace(/^\?/, "")
      .split(";")
      .filter(Boolean)
      .map((part) => Number(part));
    const n = (index: number, fallback: number) =>
      Number.isFinite(nums[index]) && (nums[index] ?? 0) > 0 ? (nums[index] as number) : fallback;
    if (cmd === "A") this.row = Math.max(0, this.row - n(0, 1));
    else if (cmd === "B") this.row = Math.min(this.height - 1, this.row + n(0, 1));
    else if (cmd === "C") this.col = Math.min(this.width - 1, this.col + n(0, 1));
    else if (cmd === "D") this.col = Math.max(0, this.col - n(0, 1));
    else if (cmd === "G") this.col = Math.min(this.width - 1, n(0, 1) - 1);
    else if (cmd === "H" || cmd === "f") {
      this.row = Math.min(this.height - 1, n(0, 1) - 1);
      this.col = Math.min(this.width - 1, n(1, 1) - 1);
    } else if (cmd === "K") {
      const mode = nums[0] ?? 0;
      const row = this.rows[this.row]!;
      const from = mode === 1 ? 0 : this.col;
      const to = mode === 1 ? this.col + 1 : mode === 2 ? this.width : this.width;
      const start = mode === 2 ? 0 : from;
      for (let c = start; c < to; c += 1) row[c] = " ";
    }
  }
}
