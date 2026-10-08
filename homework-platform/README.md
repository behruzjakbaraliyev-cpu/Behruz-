# Homework Platform

Simple homework submission system for teachers and students.

## Features

- **Teacher**: login with password, create groups, add student names, create assignments with deadlines and files, see who submitted + when, mark as Checked
- **Student**: choose group → choose own name → upload files (images, PDF, Word) → see status (Not submitted / On time / Late / Checked)
- Late submissions allowed (shown in yellow)
- Multiple files per submission (total under 20 MB)
- Assignments and members are group-specific

## How to run (on your computer)

### 1. Install Node.js
If you don’t have it: https://nodejs.org (LTS version)

### 2. Open terminal in this folder
```bash
cd homework-platform
```

### 3. Install packages
```bash
npm install
```

### 4. Start the server
```bash
npm start
```

You will see:
```
Homework Platform is running!
Local:   http://localhost:3000
Teacher password: Ab9006885
```

### 5. Open in browser
- On your computer: http://localhost:3000
- On phones / other computers (same Wi-Fi):  
  Find your computer’s IP address and open `http://YOUR-IP:3000`

**How to find your IP:**
- Windows: open Command Prompt → type `ipconfig` → look for IPv4 Address
- Mac: System Settings → Network → Wi-Fi → details
- Example: `http://192.168.1.5:3000`

## First steps after starting

1. Go to **Teacher** → login with password `Ab9006885`
2. Create a group (e.g. K.XTA-BU-23)
3. Open the group → paste student full names (one per line)
4. Go to Assignments → New Assignment → choose group, title, deadline, optional files
5. Students open the site → Student → choose group → open assignment → select their name → upload

## Change password
Teacher → Settings → Change Password

## Data storage
All data is saved in `db/data/db.json` and uploaded files are in the `uploads` folder.  
You fully own everything.

## Stop the server
Press `Ctrl + C` in the terminal.
