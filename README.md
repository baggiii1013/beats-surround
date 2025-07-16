Here is the complete README.md file:

<div align="center">

# 🚀 beats-surround

*This app is a recreation of the beatsync.gg app but only using next.js hope you find it useful*

---

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

![License](https://img.shields.io/github/license/baggiii1013/beats-surround?style=for-the-badge&color=blue)
![Stars](https://img.shields.io/github/stars/baggiii1013/beats-surround?style=for-the-badge&logo=github&color=yellow)
![Forks](https://img.shields.io/github/forks/baggiii1013/beats-surround?style=for-the-badge&logo=github&color=green)
![Version](https://img.shields.io/github/v/release/baggiii1013/beats-surround?style=for-the-badge&color=purple)

![Issues](https://img.shields.io/github/issues/baggiii1013/beats-surround?style=for-the-badge&color=red)
![Contributors](https://img.shields.io/github/contributors/baggiii1013/beats-surround?style=for-the-badge&color=orange)
![Last Commit](https://img.shields.io/github/last-commit/baggiii1013/beats-surround?style=for-the-badge&color=brightgreen)

---

**✨ [Live Demo](https://beats-surround.vercel.app) • 📚 [Documentation](https://github.com/baggiii1013/beats-surround#readme) • 🐛 [Report Bug](https://github.com/baggiii1013/beats-surround/issues) • 💡 [Request Feature](https://github.com/baggiii1013/beats-surround/issues)**

</div>

**About The Project**
--------------------

The beats-surround project is a recreation of the beatsync.gg app, but this time built using Next.js. The goal of this project is to provide a modern and intuitive interface for users to interact with their music library. The app allows users to browse and play their music, as well as manage their playlists and settings.

**Key Features**
--------------

| Feature | Description | Status |
|---------|-------------|--------|
| 🔧 **JavaScript Implementation** | Built with JavaScript | ✅ Complete |
| 📱 **Responsive Design** | Works on all devices | ✅ Complete |
| 🎨 **Modern UI** | Clean and intuitive interface | ✅ Complete |

**Built With**
------------

#### Core Technologies

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://www.javascript.com/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

#### Development Tools

[![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/)
[![yarn](https://img.shields.io/badge/yarn-2C8EBB?style=for-the-badge&logo=yarn&logoColor=white)](https://yarnpkg.com/)

**Project Structure**
--------------------

```
beats-surround/
├── .gitignore
├── R2_CLEANUP_SYSTEM.md
├── R2_SETUP_GUIDE.md
├── README.md
├── ROOM_JOINING_GUIDE.md
├── eslint.config.mjs
├── get-r2-env.sh
├── jsconfig.json
├── next.config.mjs
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── server/
│   ├── .gitignore
│   ├── enhanced-upload-handler.js
│   ├── index.js
│   ├── lib/
│   │   ├── r2.js
│   │   └── room-cleanup.js
│   └── lowlatency.config.js
│   └── package-lock.json
│   └── package.json
│   └── routes/
│       ├── cleanup.js
│       ├── default-audio.js
│       └── upload.js
└── src/
    ├── app/
    │   ├── favicon.ico
    │   └── globals.css
    │   └── layout.js
    │   └── page.js
    ├── components/
    │   ├── AudioInitializer.js
    │   ├── AudioStartButton.js
    │   ├── AudioStatusIndicator.js
    │   ├── AudioUploader.js
    │   ├── BottomNavigation.js
    │   ├── CleanupMonitor.js
    │   ├── ConnectionStatusIndicator.js
    │   ├── LoadingScreen.js
    │   ├── MobileNavigation.js
    │   ├── MobileViews.js
    │   ├── Player.js
    │   ├── Queue.js
    │   ├── ResponsiveLayout.js
    │   ├── RoomInfo.js
    │   ├── RoomJoiner.js
    │   └── RoomSelector.js
    └── SpatialAudioBackground.js
```

**Getting Started**
------------------

### Installation

1. Install the required dependencies by running `npm install` or `yarn install` in the terminal.
2. Start the development server by running `npm run dev` or `yarn dev` in the terminal.
3. Open the app in your browser by navigating to `http://localhost:3000`.

### Usage

1. Browse and play your music by clicking on the music icons.
2. Manage your playlists by clicking on the playlist icons.
3. Configure your settings by clicking on the settings icon.

**Contributing**
--------------

### Fork and Clone

1. Fork this repository by clicking the "Fork" button on the top right corner of this page.
2. Clone the forked repository by running `git clone https://github.com/your-username/beats-surround.git` in the terminal.

### Development Setup

1. Install the required dependencies by running `npm install` or `yarn install` in the terminal.
2. Start the development server by running `npm run dev` or `yarn dev` in the terminal.

### Code Style Guidelines

1. Follow the Airbnb JavaScript Style Guide.
2. Use the ESLint configuration provided in the `eslint.config.mjs` file.

### Pull Request Process

1. Create a new branch for your feature or bug fix by running `git checkout -b feature/your-feature` or `git checkout -b fix/your-bug`.
2. Make your changes and commit them by running `git add .` and `git commit -m "your-commit-message"`.
3. Push your changes to your forked repository by running `git push origin feature/your-feature` or `git push origin fix/your-bug`.
4. Create a pull request by clicking the "New pull request" button on your forked repository.
5. Wait for the pull request to be reviewed and merged.

### Issue Reporting Guidelines

1. Create a new issue by clicking the "New issue" button on the top right corner of this page.
2. Fill in the issue title and description with as much detail as possible.
3. Attach any relevant screenshots or code snippets.

### Community Guidelines

1. Be respectful and courteous to other community members.
2. Follow the community guidelines provided in the `community-guidelines.md` file.

**License**
---------

This project is licensed under the MIT License.
