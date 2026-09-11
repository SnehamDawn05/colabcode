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

function encodeBase64(str: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(str, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function decodeBase64(str: string | null | undefined): string | null {
  if (!str) return null;
  try {
    if (typeof window === "undefined") {
      return Buffer.from(str, "base64").toString("utf8");
    }
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return str;
  }
}

async function submitWithRapidAPI(
  sourceCode: string,
  languageId: number,
  stdin?: string
): Promise<ExecutionResult> {
  const submitRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=true&wait=false`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    },
    body: JSON.stringify({
      source_code: encodeBase64(sourceCode),
      language_id: languageId,
      stdin: encodeBase64(stdin ?? ""),
    }),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text().catch(() => "");
    throw new Error(`Submission failed (${submitRes.status}): ${errorText || submitRes.statusText}`);
  }
  const { token } = await submitRes.json();
  if (!token) {
    throw new Error("Execution service did not return a submission token");
  }

  // Poll for result
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(
      `${JUDGE0_BASE}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,message,status,time,memory`,
      {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      }
    );
    if (!pollRes.ok) continue;
    const rawResult: ExecutionResult = await pollRes.json();
    if (!rawResult?.status?.id) continue;
    if (rawResult.status.id > 2) {
      return {
        stdout: decodeBase64(rawResult.stdout),
        stderr: decodeBase64(rawResult.stderr),
        compile_output: decodeBase64(rawResult.compile_output),
        message: decodeBase64(rawResult.message),
        status: rawResult.status,
        time: rawResult.time,
        memory: rawResult.memory,
      };
    }
  }

  throw new Error("Execution timed out waiting for results");
}

async function submitWithPublicCE(
  sourceCode: string,
  languageId: number,
  stdin?: string
): Promise<ExecutionResult> {
  const PUBLIC_CE = "https://ce.judge0.com";

  const submitRes = await fetch(`${PUBLIC_CE}/submissions?base64_encoded=true&wait=false`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source_code: encodeBase64(sourceCode),
      language_id: languageId,
      stdin: encodeBase64(stdin ?? ""),
    }),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text().catch(() => "");
    throw new Error(`Submission failed (${submitRes.status}): ${errorText || submitRes.statusText}`);
  }
  const { token } = await submitRes.json();
  if (!token) {
    throw new Error("Execution service did not return a submission token");
  }

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const pollRes = await fetch(
      `${PUBLIC_CE}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,message,status,time,memory`
    );
    if (!pollRes.ok) continue;
    const rawResult: ExecutionResult = await pollRes.json();
    if (!rawResult?.status?.id) continue;
    if (rawResult.status.id > 2) {
      return {
        stdout: decodeBase64(rawResult.stdout),
        stderr: decodeBase64(rawResult.stderr),
        compile_output: decodeBase64(rawResult.compile_output),
        message: decodeBase64(rawResult.message),
        status: rawResult.status,
        time: rawResult.time,
        memory: rawResult.memory,
      };
    }
  }

  throw new Error("Execution timed out waiting for results");
}

/**
 * Execute source code via Judge0.
 * Automatically uses RapidAPI if NEXT_PUBLIC_RAPIDAPI_KEY is set,
 * otherwise falls back to the public CE endpoint.
 */
export async function runCode(language: string, sourceCode: string, stdin?: string): Promise<RunResult> {
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
    ? await submitWithRapidAPI(sourceCode, languageId, stdin)
    : await submitWithPublicCE(sourceCode, languageId, stdin);

  // Guard against unexpected API responses where status is missing
  if (!result?.status?.id) {
    throw new Error("Received an invalid response from the execution service. Please try again.");
  }

  const statusId = result.status.id;

  // stdout only — never put compile errors into the output panel
  const output = result.stdout?.trimEnd() || "";

  // Build a meaningful error string:
  //   • Compilation Error (id 6)  → compile_output
  //   • Runtime errors (id 7-12)  → stderr first, then compile_output/message
  //   • Time Limit Exceeded (id 5) → stderr / message / TLE notice
  //   • Accepted (id 3)           → no error
  const rawCompile = result.compile_output?.trimEnd() || null;
  const rawStderr  = result.stderr?.trimEnd()         || null;
  const rawMessage = result.message?.trimEnd()         || null;

  let error: string | null = null;
  if (statusId === 6) {
    // Compilation Error: compile_output has the exact file, line, column, and syntax error
    error = rawCompile ?? rawStderr ?? rawMessage ?? "Compilation error occurred";
  } else if (statusId === 5) {
    error = rawStderr ?? rawMessage ?? "Time Limit Exceeded (program took too long to complete)";
  } else if (statusId >= 7 && statusId <= 12) {
    error = rawStderr ?? rawMessage ?? rawCompile ?? statusLabel(statusId);
  } else if (statusId !== 3 && statusId !== 1 && statusId !== 2) {
    error = rawStderr ?? rawCompile ?? rawMessage ?? statusLabel(statusId);
  }

  return {
    output,
    error,
    statusDescription: statusLabel(statusId),
    time: result.time,
    memory: result.memory,
    languageId,
    supported: true,
  };
}
