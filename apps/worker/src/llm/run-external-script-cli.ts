#!/usr/bin/env node
import { runExternalScriptGeneration } from "./run-external-script.js";

const code = await runExternalScriptGeneration(process.argv.slice(2));
process.exitCode = code;
