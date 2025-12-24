#!/usr/bin/env node

import dotenv from "dotenv";
import chalk from "chalk";
import boxen from "boxen";

import figlet from "figlet";
import {Command} from "commander";
import { login, logout, whoami } from "./commands/auth/login.js";
import { chat } from "./commands/chat.js";
import { agent } from "./commands/agent.js";
import { config } from "./commands/config.js";

dotenv.config();

async function main(){
      // Display banner
  console.log(
    chalk.cyan(
      figlet.textSync("Apex CLI", {
        font: "Standard",
        horizontalLayout: "default",
      })
    )
  );
  console.log(chalk.gray("A Cli based AI tool \n"));
  const program =new Command("apex");

  program.version("0.0.1").description("A Cli based AI tool")
    .addCommand(login)
    .addCommand(logout)
    .addCommand(whoami)
    .addCommand(chat)
    .addCommand(agent)
    .addCommand(config)


  program.action((options)=>{
    program.help();
  })

  program.parse()

}

main().catch((err)=>{
    console.log(chalk.red("Error while running Apex cli",err)); 
    process.exit();
});

