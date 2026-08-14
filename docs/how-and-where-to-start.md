# How and Where to Start — Securiq AWS Scanner


## Step 1: Get comfortable with the basic tools first

Before writing any project code, make sure we have these things installed and we've run at least one "hello world" with each:

1. **Node.js** — the language/runtime your backend will run on.
   - Install from nodejs.org (LTS version)
   - Test: open terminal, type `node -v` — if it shows a version number, you're good
2. **Git + GitHub** — to save and share code.
   - Create a free GitHub account if you don't have one
   - Install Git, test with `git --version`
3. **A code editor** — VS Code is the standard, free, and has good AWS/Node extensions
4. **An AWS account** — create a free-tier account. This will be your **test/sandbox account**, never your real/production account.

## Step 2: Learn just enough AWS to be dangerous

we don't need to be an AWS expert. e need to understand 4 concepts:

- **S3** = file storage (buckets that hold files)
- **EC2** = virtual servers, and **Security Groups** = firewall rules for them
- **IAM** = the permission system (who/what can do what)
- **Access Keys** = a username+password pair your code uses to talk to AWS on your behalf

Spend 1–2 hours: create an S3 bucket manually in the AWS Console, create an EC2 instance, look at IAM users. Just click around.

## Step 3: Give your app a safe way to talk to AWS

1. In AWS Console, go to IAM → Users → create a new user just for this app (not your personal login)
2. Attach a policy called **SecurityAudit** or **ReadOnlyAccess** — this means your app can *look* at things but can't break anything yet
3. Generate an **Access Key** for this user — you'll get an Access Key ID and Secret Access Key
4. **Never share these keys or put them in code that goes to GitHub.** Store them in a `.env` file (a file just for secrets) and add `.env` to a `.gitignore` file so Git never uploads it

## Step 4: Prove the connection works (before building anything fancy)

1. Create a new folder, run `npm init -y` inside it
2. Install the AWS toolkit: `npm install @aws-sdk/client-s3 dotenv`
3. Write ONE small script that does ONE thing: connect to AWS using your keys, and print a list of your S3 buckets to the terminal
4. Run it. If you see your bucket names printed, you've proven the entire foundation works.

## Step 5: Build the "look around" part (collectors)

Now expand that one script into a few small scripts, each responsible for pulling info about ONE AWS thing:
- One script lists all S3 buckets and their settings
- One script lists all security groups and their open ports
- One script lists all IAM users and their permissions

don't check for problems yet — just gather and print the raw information. Confirm each script runs and shows sensible data.

## Step 6: Build the "spot the problem" part (scanners)

Now add simple logic on top of Step 5's data:
- "If a bucket is public → that's a problem, save it as a finding"
- "If a security group allows port 22 from anywhere → that's a problem"

A "finding" is just a small note: what resource, what's wrong, how serious. Save these findings somewhere simple — a JSON file at first, or a lightweight database once you're ready (SQLite is the easiest to start with, zero setup).

## Step 7: Build a simple way to see the results

Before building a fancy website, just print the findings in the terminal as a readable list. Only once that's solid do you move to a real webpage.

Then: build a very basic webpage (React) with one button ("Scan Now") and one table (list of findings). Nothing else yet.

## Step 8: Build the "fix it" part (remediation) — carefully

Only start this after Steps 1–7 work reliably.

- Start with "dry-run" mode: the code says what it *would* fix, but doesn't actually touch AWS
- Once you trust it, let it apply ONE type of fix (e.g., turning on "Block Public Access" for a bucket) on your test account
- Always test fixes on your sandbox account, never on anything real, until you're confident

## Step 9: Divide the work as a team

- **2 people on backend**: one focuses on Steps 4–5 (connecting + gathering data), the other on Steps 6 + 8 (spotting problems + fixing them)
- **1 person on frontend**: can start building the webpage using fake/sample data immediately, without waiting for the backend — then swap in real data once it's ready

## Quick reference: the order, one line each

1. Install tools, create AWS test account
2. Explore AWS manually (S3, EC2, IAM)
3. Create a restricted AWS user + keys for your app
4. Write one script that connects and lists S3 buckets
5. Write collector scripts (gather raw AWS data)
6. Write scanner logic (flag problems from that data)
7. Show findings — terminal first, then simple webpage
8. Add fixes — dry-run first, then real, one at a time
9. Split work across the team, build in parallel where possible
