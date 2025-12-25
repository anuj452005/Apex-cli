
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

const CONFIG_DIR = path.join(os.homedir(), ".apex-cli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig() {
  ensureConfigDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(chalk.yellow("Warning: Could not load config file"));
  }
  return {};
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getConfigValue(key) {
  const config = loadConfig();
  return config[key];
}

export function setConfigValue(key, value) {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

export function deleteConfigValue(key) {
  const config = loadConfig();
  delete config[key];
  saveConfig(config);
}

async function setAction(key, value) {
  if (!key) {
    console.log(chalk.red("❌ Please provide a key to set"));
    return;
  }

  if (!value) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    value = await new Promise((resolve) => {
      rl.question(chalk.cyan(`Enter value for ${key}: `), (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!value) {
    console.log(chalk.red("❌ Value cannot be empty"));
    return;
  }

  setConfigValue(key, value);
  console.log(chalk.green(`✅ ${key} has been set successfully`));
  console.log(chalk.gray(`   Config saved to: ${CONFIG_FILE}`));
}

function getAction(key) {
  if (!key) {
    console.log(chalk.red("❌ Please provide a key to get"));
    return;
  }

  const value = getConfigValue(key);
  if (value) {

    const isSensitive = key.toLowerCase().includes("key") || key.toLowerCase().includes("secret");
    const displayValue = isSensitive ? value.slice(0, 8) + "..." + value.slice(-4) : value;
    console.log(chalk.cyan(`${key}: `) + chalk.white(displayValue));
  } else {
    console.log(chalk.yellow(`${key} is not set`));
  }
}

function listAction() {
  const config = loadConfig();
  const keys = Object.keys(config);

  if (keys.length === 0) {
    console.log(chalk.yellow("No configuration values set"));
    console.log(chalk.gray("\nTo set your Google API key:"));
    console.log(chalk.cyan("  apex config set GOOGLE_API_KEY <your-api-key>"));
    return;
  }

  console.log(chalk.cyan("\n📋 Configuration:"));
  console.log(chalk.gray("═".repeat(50)));

  for (const key of keys) {
    const value = config[key];

    const isSensitive = key.toLowerCase().includes("key") || key.toLowerCase().includes("secret");
    const displayValue = isSensitive ? value.slice(0, 8) + "..." + value.slice(-4) : value;
    console.log(chalk.white(`  ${key}: `) + chalk.gray(displayValue));
  }

  console.log(chalk.gray("═".repeat(50)));
  console.log(chalk.gray(`Config file: ${CONFIG_FILE}\n`));
}

function deleteAction(key) {
  if (!key) {
    console.log(chalk.red("❌ Please provide a key to delete"));
    return;
  }

  const value = getConfigValue(key);
  if (value) {
    deleteConfigValue(key);
    console.log(chalk.green(`✅ ${key} has been deleted`));
  } else {
    console.log(chalk.yellow(`${key} was not set`));
  }
}

export const config = new Command("config")
  .description("Manage API keys and configuration")
  .addCommand(
    new Command("set")
      .description("Set a configuration value")
      .argument("<key>", "Configuration key (e.g., GOOGLE_API_KEY)")
      .argument("[value]", "Configuration value (will prompt if not provided)")
      .action(setAction)
  )
  .addCommand(
    new Command("get")
      .description("Get a configuration value")
      .argument("<key>", "Configuration key to retrieve")
      .action(getAction)
  )
  .addCommand(
    new Command("list")
      .description("List all configuration values")
      .action(listAction)
  )
  .addCommand(
    new Command("delete")
      .description("Delete a configuration value")
      .argument("<key>", "Configuration key to delete")
      .action(deleteAction)
  );
