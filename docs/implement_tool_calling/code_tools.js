/**
 * Code Execution Tools
 * 
 * Tools for executing code snippets in a controlled environment.
 * Supports JavaScript and Python execution.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { TOOLS_CONFIG } from "../config.js";

/**
 * Execute JavaScript code using Node.js
 */
async function executeJavaScript(code, timeout) {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `apex_code_${Date.now()}.js`);

    // Wrap code in try-catch for better error handling
    const wrappedCode = `
try {
  const result = (async () => {
    ${code}
  })();
  
  Promise.resolve(result).then(r => {
    if (r !== undefined) console.log(JSON.stringify(r, null, 2));
  }).catch(e => console.error('Error:', e.message));
} catch (error) {
  console.error('Error:', error.message);
}
`;

    fs.writeFile(tempFile, wrappedCode)
      .then(() => {
        let output = "";
        let error = "";

        const proc = spawn("node", [tempFile], {
          timeout,
          stdio: ["ignore", "pipe", "pipe"],
        });

        proc.stdout.on("data", (data) => {
          output += data.toString();
        });

        proc.stderr.on("data", (data) => {
          error += data.toString();
        });

        proc.on("close", (exitCode) => {
          // Clean up temp file
          fs.unlink(tempFile).catch(() => {});

          if (error && !output) {
            resolve({ success: false, output: error.trim() });
          } else {
            resolve({
              success: exitCode === 0,
              output: (output + (error ? `\nStderr: ${error}` : "")).trim(),
            });
          }
        });

        proc.on("error", (err) => {
          fs.unlink(tempFile).catch(() => {});
          resolve({ success: false, output: `Execution error: ${err.message}` });
        });
      })
      .catch((err) => {
        resolve({ success: false, output: `Failed to create temp file: ${err.message}` });
      });
  });
}

/**
 * Execute Python code
 */
async function executePython(code, timeout) {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `apex_code_${Date.now()}.py`);

    // Wrap code in try-except
    const wrappedCode = `
import json
import sys

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
`;

    fs.writeFile(tempFile, wrappedCode)
      .then(() => {
        let output = "";
        let error = "";

        // Try python3 first, then python
        const pythonCmd = process.platform === "win32" ? "python" : "python3";

        const proc = spawn(pythonCmd, [tempFile], {
          timeout,
          stdio: ["ignore", "pipe", "pipe"],
        });

        proc.stdout.on("data", (data) => {
          output += data.toString();
        });

        proc.stderr.on("data", (data) => {
          error += data.toString();
        });

        proc.on("close", (exitCode) => {
          fs.unlink(tempFile).catch(() => {});

          if (error && !output) {
            resolve({ success: false, output: error.trim() });
          } else {
            resolve({
              success: exitCode === 0,
              output: (output + (error ? `\nStderr: ${error}` : "")).trim(),
            });
          }
        });

        proc.on("error", (err) => {
          fs.unlink(tempFile).catch(() => {});
          resolve({ success: false, output: `Execution error: ${err.message}` });
        });
      })
      .catch((err) => {
        resolve({ success: false, output: `Failed to create temp file: ${err.message}` });
      });
  });
}

/**
 * EXECUTE CODE TOOL
 * Runs code snippets in JavaScript or Python
 */
export const executeCodeTool = new DynamicStructuredTool({
  name: "execute_code",
  description: "Execute a code snippet in JavaScript or Python. Returns the output or error.",
  schema: z.object({
    code: z.string().describe("The code to execute"),
    language: z.enum(["javascript", "python"]).describe("Programming language (javascript or python)"),
  }),
  func: async ({ code, language }) => {
    // Check if code execution is enabled
    if (!TOOLS_CONFIG.codeExecution.enabled) {
      return "Error: Code execution is disabled in configuration.";
    }

    // Check language is allowed
    if (!TOOLS_CONFIG.codeExecution.allowedLanguages.includes(language)) {
      return `Error: Language "${language}" is not allowed. Allowed: ${TOOLS_CONFIG.codeExecution.allowedLanguages.join(", ")}`;
    }

    const timeout = TOOLS_CONFIG.codeExecution.timeoutMs;

    let result;
    if (language === "javascript") {
      result = await executeJavaScript(code, timeout);
    } else if (language === "python") {
      result = await executePython(code, timeout);
    }

    // Truncate output if too long
    let output = result.output || "(no output)";
    if (output.length > TOOLS_CONFIG.codeExecution.maxOutputLength) {
      output = output.slice(0, TOOLS_CONFIG.codeExecution.maxOutputLength) + "\n... (output truncated)";
    }

    return `${result.success ? "✓ Execution successful" : "✗ Execution failed"}\n\nOutput:\n${output}`;
  },
});

/**
 * EVALUATE EXPRESSION TOOL
 * Quick evaluation of simple expressions
 */
export const evaluateExpressionTool = new DynamicStructuredTool({
  name: "evaluate_expression",
  description: "Quickly evaluate a simple JavaScript expression. Good for calculations.",
  schema: z.object({
    expression: z.string().describe("The JavaScript expression to evaluate (e.g., '2 + 2', 'Math.sqrt(16)')"),
  }),
  func: async ({ expression }) => {
    try {
      // Only allow safe expressions (no function calls except Math)
      const safePattern = /^[\d\s+\-*/().%^&|!<>=?:,Math.a-z]+$/i;

      if (!safePattern.test(expression)) {
        return "Error: Expression contains unsafe characters. Only basic math operations are allowed.";
      }

      // Evaluate in a limited context
      const result = eval(expression);

      return `Result: ${result}`;
    } catch (error) {
      return `Error evaluating expression: ${error.message}`;
    }
  },
});

// Export all code tools
export const codeTools = [
  executeCodeTool,
  evaluateExpressionTool,
];

export default codeTools;
