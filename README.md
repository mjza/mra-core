# Core API service

## Creation Steps
1. Created a `mra-core` repository in GitHub
2. Created a `mra-core` Heroku app and connected it to the repository.
3. Activated `Automatic deploys` in Heroku after connecting to the repository.
4. Used `npm init -y` to initialize a new Node.js project.
5. Installed Express, and PostgreSQL database client libraries.
```
npm install express pg
```
6. Add a `Procfile` to the application. This file is used for starting the application in Heroku and must have the following content.
Please note that Heroku does not use the start script in of the `package.json`.
```
web: NODE_ENV=production node src/index.mjs
``` 


## GitHub Setup

### Setup Instructions for Mac

After cloning the repository, run the following command to set up the commit message template locally:

```bash
./setup.sh
```

You need to make sure the script has execute permissions:

```bash
chmod +x setup.sh
```

This will configure Git to use the commit message template for this repository only.

### Setup Instructions for Windows

Open Command Prompt or PowerShell, navigate to the repository directory, and run:

```bash
.\setup.bat
```

## Loading `MY_PAT` from `.env` File Automatically

If you want `MY_PAT` to be loaded from a `.env` file automatically, as you need it for installing private packages, you can use a tool like `dotenv-cli` to load the environment variables before running `npm install`. Here’s how to set it up:

### Step 1: Install `dotenv-cli` globally

First, you need to install `dotenv-cli`, which helps load `.env` variables into your environment.

```bash
npm install -g dotenv-cli
```

If face with the following error:

```bash
npm error The operation was rejected by your operating system.
npm error It is likely you do not have the permissions to access this file as the current user
npm error
npm error If you believe this might be a permissions issue, please double-check the
npm error permissions of the file and its containing directories, or try running
npm error the command again as root/Administrator.
```

Then it means you must use the command `sudo ` before the `npm install -g dotenv-cli` and then type your password.

### Step 2: Create a `.env` File

Ensure you have a `.env` file in `/src/config/` directory. For example:

```
MY_PAT=your_personal_access_token_here
```

### Step 3: Run `npm install` with `dotenv`

Now, when you run `npm install`, use `dotenv` to load the `.env` file:

```
dotenv -e ./src/config/.env -- npm install
```

### Update nodejs packages
First make sure `dotenv` has been installed globally.
Then use `npm-check-updates` to automate the process of checking and updating your dependencies:

```bash
dotenv -e ./src/config/.env -- npx npm-check-updates -u
dotenv -e ./src/config/.env -- npm install
```

## Install private packages using `.npmrc` Manually
As we are running npm to install packages locally, the `MY_PAT` (which is your PAT) needs to be set as an environment variable. Here’s how it works in different environments:

1. Generate a personal access token (PAT) in GitHub
2. Set the `MY_PAT` environment variable in your shell manually (or via a script):

For Linux/macOS:

```bash
export MY_PAT=<your_personal_access_token>
```

For Windows (PowerShell):

```powershell
$env:MY_PAT="<your_personal_access_token>"
```
3. Run `npm install` after setting the environment variable.

## Install Heroku CLI
Follow the instructions in this [link](https://devcenter.heroku.com/articles/heroku-cli#verify-your-installation) and install Heroku CLI. 

## local
Copy `config/template.env` file and rename it to `config/.env`.
Update its content accordingly with respect to your system. 

## production

For the production: 
1. You must change the `XXX` in the following list accordingly from `Settings` tab of the `mra-database` application. 

2. You must change `YYY` must be replaced via [https://app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys).

```bash
heroku config:set BASE_URL=http://core.myreport.app --app mra-core
heroku config:set DB_USER=XXX --app mra-core
heroku config:set DB_HOST=XXX --app mra-core
heroku config:set DB_NAME=XXX --app mra-core
heroku config:set DB_PASSWORD=XXX --app mra-core
heroku config:set DB_PORT=5432 --app mra-core
heroku config:set DOC_URL=/docs --app mra-core
heroku config:set DOC_PASS=Zu~0WC,X,8h3Hh@s --app mra-core
heroku config:set DOC_USER=modir --app mra-core
heroku config:set NODE_ENV=production --app mra-core
heroku config:set PORT=443 --app mra-core
heroku config:set TZ=UTC --app mra-core
heroku config:set ACTIVATE_SWAGGER=true --app mra-core
```

Then run run the above commands in the Heroku CLI or go to the `mra-core` application, then in the `Settings` tab press on the `Reveal Config Vars` button and edit them directly. Like the following picture:
![](./images/figure3.png)


## creating SSL for localhost

```bash
openssl req -x509 -newkey rsa:4096 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"
```

## Generate a 256-bit (32-byte) random key and print it in hexadecimal format
```bash 
openssl rand -hex 32
```
This key is used as SECRET_KEY in .env file. 

## Generate documentations using JSDoc
```bash
npm run generate-docs
```

## GitHub configuration
`HEROKU_API_KEY` is the api key for accessing `mra-core` application, and `MY_PAT` is my personal access token of GitHub for tagging releases. They have been particularly set in GitHub secrets.

Use `heroku cores:create` for creating a key for setting `HEROKU_API_KEY`.

![](./images/figure4.png)

They are needed in the workflow codes that we generated for automatically tagging the releases based on the version number in Heroku. The code exist in `.github\workflows` folder. 

`main.yml` is run automatically when we push to main branch. However, after a seccessful push to Heroku, we must run the other workflow in GitHub manually. 
![](./images/figure5.png)
