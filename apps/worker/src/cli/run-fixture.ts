#!/usr/bin/env node
import { runFixtureCli } from "./pipeline.js";

const code = await runFixtureCli(process.argv.slice(2));
process.exitCode = code;
