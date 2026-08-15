/**
 * Judge0 CE public API integration for code execution.
 * Uses the free community endpoint — no API key needed for basic usage.
 *
 * Language IDs: https://ce.judge0.com/languages
 */

const JUDGE0_BASE = "https://judge0-ce.p.rapidapi.com";

// Rapid API key is optional. Without it we use the public CE endpoint.
// Set NEXT_PUBLIC_RAPIDAPI_KEY in .env.local for higher rate limits.
const RAPIDAPI_KEY = process.env.NEXT_PUBLIC_RAPIDAPI_KEY ?? "";
const USE_RAPIDAPI = Boolean(RAPIDAPI_KEY);

/** Maps Monaco language IDs → Judge0 language IDs */
const LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,   // Node.js 12
  typescript: 74,   // TypeScript 3.7
  python: 71,       // Python 3.8
  java: 62,         // Java 13
  c: 50,            // C (GCC 9)
  cpp: 54,          // C++ (GCC 9)
  "c++": 54,
  csharp: 51,       // C# (Mono 6)
  "c#": 51,
  go: 60,           // Go 1.13
  rust: 73,         // Rust 1.40
  ruby: 72,         // Ruby 2.7
  php: 68,          // PHP 7.4
  swift: 83,        // Swift 5.2
  kotlin: 78,       // Kotlin 1.3
  scala: 81,        // Scala 2.12
  r: 80,            // R 4.0
  bash: 46,         // Bash 5.0
  sql: 82,          // SQLite 3.27
};

export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

export interface RunResult {
  output: string;
  error: string | null;
  statusDescription: string;
  time: string | null;
  memory: number | null;
  languageId: number | null;
  supported: boolean;
}

/** Returns true if the given Monaco language has a Judge0 mapping */
export function isLanguageSupported(language: string): boolean {
  return language.toLowerCase() in LANGUAGE_MAP;
}

/** Returns the human-readable name of a Judge0 status */
function statusLabel(id: number): string {
  const labels: Record<number, string> = {
    1: "In Queue",
    2: "Processing",
    3: "Accepted",
    4: "Wrong Answer",
    5: "Time Limit Exceeded",
    6: "Compilation Error",
    7: "Runtime Error (SIGSEGV)",
    8: "Runtime Error (SIGXFSZ)",
    9: "Runtime Error (SIGFPE)",
    10: "Runtime Error (SIGABRT)",
    11: "Runtime Error (NZEC)",
    12: "Runtime Error (Other)",
    13: "Internal Error",
    14: "Exec Format Error",
  };
  return labels[id] ?? "Unknown";
}

async function submitWithRapidAPI(
  sourceCode: string,
  languageId: number
): Promise<ExecutionResult> {
  // Submit
  const submitRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    },
    body: JSON.stringify({ source_code: sourceCode, language_id: languageId }),
  });

  if (!submitRes.ok) throw new Error(`Submission failed: ${submitRes.status}`);
  const { token } = await submitRes.json();

  // Poll for result
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(
      `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`,
      {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      }
    );
    const result: ExecutionResult = await pollRes.json();
    if (result.status.id > 2) return result; // not queued/processing
  }

  throw new Error("Execution timed out");
}

async function submitWithPublicCE(
  sourceCode: string,
  languageId: number
): Promise<ExecutionResult> {
  const PUBLIC_CE = "https://ce.judge0.com";

  const submitRes = await fetch(`${PUBLIC_CE}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source_code: sourceCode, language_id: languageId }),
  });

  if (!submitRes.ok) throw new Error(`Submission failed: ${submitRes.status}`);
  const { token } = await submitRes.json();

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const pollRes = await fetch(
      `${PUBLIC_CE}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`
    );
    const result: ExecutionResult = await pollRes.json();
    if (result.status.id > 2) return result;
  }

  throw new Error("Execution timed out");
}

/**
 * Execute source code via Judge0.
 * Automatically uses RapidAPI if NEXT_PUBLIC_RAPIDAPI_KEY is set,
 * otherwise falls back to the public CE endpoint.
 */
export async function runCode(language: string, sourceCode: string): Promise<RunResult> {
  const langKey = language.toLowerCase();
  const languageId = LANGUAGE_MAP[langKey];

  if (!languageId) {
    return {
      output: "",
      error: null,
      statusDescription: "Unsupported",
      time: null,
      memory: null,
      languageId: null,
      supported: false,
    };
  }

  const result = USE_RAPIDAPI
    ? await submitWithRapidAPI(sourceCode, languageId)
    : await submitWithPublicCE(sourceCode, languageId);

  const output =
    result.stdout?.trimEnd() ??
    result.compile_output?.trimEnd() ??
    result.message?.trimEnd() ??
    "";

  const error =
    result.stderr?.trimEnd() ??
    (result.status.id !== 3 && result.status.id !== 1 && result.status.id !== 2
      ? result.compile_output?.trimEnd() ?? null
      : null);

  return {
    output,
    error,
    statusDescription: statusLabel(result.status.id),
    time: result.time,
    memory: result.memory,
    languageId,
    supported: true,
  };
}
