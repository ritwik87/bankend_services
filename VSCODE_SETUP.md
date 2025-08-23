# 🛠️ VS Code Setup for DUPR Service

This guide helps you set up VS Code for optimal development experience with the DUPR Service project.

## 🚀 Quick Setup

### **1. Open the Project**
```bash
# Option 1: Open directory
code dupr-service

# Option 2: Open workspace file (recommended)
code dupr-service.code-workspace
```

### **2. Install Recommended Extensions**
VS Code will automatically suggest installing recommended extensions. Click "Install All" or install individually:

- **TypeScript Language Features** - Enhanced TypeScript support
- **ESLint** - Real-time linting and error detection  
- **Prettier** - Code formatting
- **Path Intellisense** - Auto-complete for file paths
- **Error Lens** - Inline error display
- **Thunder Client** - API testing within VS Code
- **Code Spell Checker** - Catch typos in code and comments

### **3. Configure Environment**
1. Copy `.env.example` to `.env`
2. Update with your DUPR API credentials
3. Restart VS Code to load environment variables

## 🐛 Debug Configurations

### **Available Configurations**

| Configuration | Purpose | Usage |
|--------------|---------|--------|
| 🚀 **Debug DUPR Service** | Main application debugging | Press `F5` or use Debug panel |
| 🧪 **Debug DUPR Tests** | Test suite debugging | Debug all tests with breakpoints |
| 🔍 **Debug Current Test File** | Single test file debugging | Debug only the open test file |
| 🏗️ **Debug Build Process** | TypeScript compilation debugging | Debug build issues |
| 🔧 **Attach to Running Service** | Connect to running process | Debug production scenarios |

### **Starting a Debug Session**

1. **Set Breakpoints**: Click in the editor gutter (left of line numbers)
2. **Choose Configuration**: Select from dropdown in Debug panel
3. **Start Debugging**: Press `F5` or click the play button
4. **Interact with API**: Use Thunder Client, curl, or browser to trigger endpoints

### **Debug Controls**
- `F5` - Continue/Start
- `F10` - Step Over
- `F11` - Step Into  
- `Shift+F11` - Step Out
- `Ctrl+Shift+F5` - Restart
- `Shift+F5` - Stop

## 🧪 Testing Integration

### **Running Tests**
```bash
# All tests
npm test

# With debugging
npm run test:debug

# Watch mode  
npm run test:watch

# Coverage report
npm test -- --coverage
```

### **Debugging Tests**
1. Open test file (e.g., `duprController.test.ts`)
2. Set breakpoints in test or source code
3. Use "Debug Current Test File" configuration
4. Step through test execution

### **Custom Test Matchers**
The project includes custom Jest matchers:
```typescript
expect('4581541063').toBeValidDuprId();
expect(4.25).toBeValidRating();
```

## 📁 Project Structure & Navigation

### **File Organization**
```
dupr-service/
├── .vscode/              # VS Code configuration
│   ├── launch.json       # Debug configurations
│   ├── settings.json     # Editor settings  
│   ├── tasks.json        # Build tasks
│   ├── extensions.json   # Recommended extensions
│   └── snippets.json     # Code snippets
├── src/
│   ├── controllers/      # API endpoint handlers
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── routes/           # Route definitions
│   ├── types/            # TypeScript interfaces
│   ├── utils/            # Helper functions
│   ├── swagger/          # API documentation
│   └── test/             # Test utilities
└── dist/                 # Compiled JavaScript
```

### **Quick Navigation**
- `Ctrl+P` - Quick file open
- `Ctrl+Shift+P` - Command palette
- `Ctrl+T` - Go to symbol
- `F12` - Go to definition
- `Alt+F12` - Peek definition
- `Shift+F12` - Find all references

## 🎨 Code Snippets

The project includes custom snippets for faster development:

| Snippet | Trigger | Description |
|---------|---------|-------------|
| `dupr-controller` | Controller method with error handling |
| `dupr-service` | Service method with authentication |
| `dupr-test` | Test suite template |
| `dupr-validation` | Joi validation schema |
| `dupr-log` | Logger statement |

**Usage**: Type the trigger and press `Tab` to expand.

## 🔧 Tasks & Scripts

### **Available Tasks** (Ctrl+Shift+P → "Tasks: Run Task")

- **🚀 Start DUPR Service (Dev)** - Start with hot reload
- **🔨 Build DUPR Service** - Compile TypeScript
- **🧪 Run Tests** - Execute test suite
- **🔍 Run Tests (Watch)** - Tests in watch mode
- **🧹 Lint Code** - Check code quality
- **🔧 Fix Lint Issues** - Auto-fix linting problems
- **📚 Open API Documentation** - Launch Swagger docs
- **📋 Test Service Endpoints** - Run endpoint tests

### **NPM Scripts** (NPM Scripts Panel)

```json
{
  "dev": "Start development server",
  "dev:debug": "Start with debug port",
  "build": "Compile TypeScript", 
  "test": "Run Jest tests",
  "test:debug": "Debug Jest tests",
  "lint": "ESLint check",
  "docs:open": "Open Swagger documentation"
}
```

## 🌐 API Development

### **Swagger Integration**
- **Interactive Docs**: Automatically opens at `http://localhost:3001/docs`
- **OpenAPI Spec**: Available at `http://localhost:3001/docs/json`
- **Thunder Client**: Import collection from Swagger for testing

### **Testing API Endpoints**

#### **Using Thunder Client** (Recommended)
1. Install Thunder Client extension
2. Create new request
3. Set method and URL (e.g., `POST http://localhost:3001/api/dupr/validate`)
4. Add request body:
   ```json
   {
     "duprId": "4581541063",
     "email": "test@example.com"
   }
   ```
5. Send request and view response

#### **Using Built-in Terminal**
```bash
# Test validation endpoint
curl -X POST http://localhost:3001/api/dupr/validate \
  -H "Content-Type: application/json" \
  -d '{"duprId": "4581541063"}'

# Test health check
curl http://localhost:3001/api/dupr/health
```

## 🎯 Productivity Features

### **IntelliSense & Auto-completion**
- **TypeScript**: Full type checking and suggestions
- **Path Completion**: Auto-complete for imports and file paths
- **API Schema**: Auto-complete for request/response objects
- **Environment Variables**: Suggestions for .env variables

### **Code Actions**
- **Auto Import**: Automatically add import statements
- **Organize Imports**: Sort and group imports on save
- **Quick Fix**: Fix ESLint errors automatically
- **Extract Method**: Refactor code into functions
- **Rename Symbol**: Rename variables across files

### **Live Error Detection**
- **Error Lens**: Inline error display
- **Problem Panel**: All errors and warnings
- **TypeScript Errors**: Real-time compilation errors
- **ESLint Issues**: Code quality problems
- **Test Failures**: Failed test indicators

## 🔍 Advanced Debugging

### **Conditional Breakpoints**
Right-click breakpoint → "Edit Breakpoint" → Add condition:
```javascript
duprId === '4581541063' && request.method === 'POST'
```

### **Logpoints** (Non-breaking logging)
Right-click in gutter → "Add Logpoint":
```javascript
Validating DUPR ID: {duprId} with email: {email}
```

### **Hit Count Breakpoints**
```
>5        // Break after 5th hit
%3        // Break every 3rd hit  
==10      // Break exactly on 10th hit
```

### **Debug Console Commands**
```javascript
// Evaluate expressions in current scope
duprId
request.body
response.locals

// Call functions
validateRequest(schema, data)
logger.info('Debug message', { data })

// Check memory usage
process.memoryUsage()
```

## 🚨 Troubleshooting

### **Common Issues**

#### **Breakpoints Not Hitting**
1. Check source maps are enabled in `tsconfig.json`
2. Verify file paths in `launch.json`
3. Restart debugging session
4. Clear compiled `dist/` directory

#### **Environment Variables Not Loading**
1. Check `.env` file exists and has correct syntax
2. Verify `envFile` path in launch configuration
3. Restart VS Code
4. Check file permissions

#### **TypeScript Errors**
1. Run `npm run build` to check compilation
2. Restart TypeScript service: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
3. Clear VS Code cache: `Ctrl+Shift+P` → "Developer: Reload Window"

#### **Extension Issues**
1. Check extension compatibility
2. Update extensions to latest versions
3. Disable conflicting extensions
4. Reset workspace settings if needed

### **Performance Optimization**
```json
// Add to settings.json for better performance
{
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "typescript.suggest.includeAutomaticOptionalChainCompletions": false,
  "search.followSymlinks": false,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true
  }
}
```

## 📊 Monitoring & Logging

### **Winston Logger Integration**
```typescript
// Different log levels
logger.debug('Debug information', { data });
logger.info('General information', { data });  
logger.warn('Warning message', { data });
logger.error('Error occurred', error);
```

### **Log Files**
- `logs/error.log` - Error messages only
- `logs/combined.log` - All log messages
- **Console Output** - Development mode logging

### **Performance Monitoring**
```typescript
// Add timing to functions
console.time('API Call');
// ... your code
console.timeEnd('API Call');

// Memory usage
const usage = process.memoryUsage();
logger.info('Memory usage', usage);
```

## 🎉 Tips & Best Practices

### **Keyboard Shortcuts**
- `Ctrl+`` ` - Toggle integrated terminal
- `Ctrl+Shift+`` ` - Create new terminal
- `Ctrl+B` - Toggle sidebar
- `Ctrl+J` - Toggle panel
- `F1` - Command palette
- `Ctrl+K Ctrl+S` - Keyboard shortcuts reference

### **Multi-cursor Editing**
- `Alt+Click` - Add cursor
- `Ctrl+Alt+↑/↓` - Add cursor above/below
- `Ctrl+D` - Select next occurrence
- `Ctrl+Shift+L` - Select all occurrences

### **Code Organization**
- **Consistent Naming**: Use descriptive function and variable names
- **Type Annotations**: Explicit types for better IntelliSense
- **Error Handling**: Use try-catch blocks with proper logging
- **Comments**: JSDoc comments for better documentation

### **Git Integration**
- **Source Control Panel**: View changes, stage, commit
- **GitLens Extension**: Enhanced Git capabilities
- **Diff Views**: Compare file versions
- **Branch Management**: Switch branches from status bar

Happy coding! 🚀

> 💡 **Pro Tip**: Use the workspace file (`dupr-service.code-workspace`) for the best experience with all configurations pre-loaded.