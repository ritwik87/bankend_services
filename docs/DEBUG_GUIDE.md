# 🐛 DUPR Service - VS Code Debugging Guide

This guide explains how to use VS Code's powerful debugging features with the DUPR Service project.

## 🚀 Quick Start

1. **Open the project in VS Code**:
   ```bash
   code dupr-service
   ```

2. **Set breakpoints** by clicking in the editor gutter (left of line numbers)

3. **Start debugging** using one of these methods:
   - Press `F5` or `Ctrl+F5`
   - Go to **Run and Debug** panel (`Ctrl+Shift+D`)
   - Use **Command Palette** (`Ctrl+Shift+P`) → "Debug: Start Debugging"

## 🎯 Available Debug Configurations

### 1. 🚀 **Debug DUPR Service** (Default)
- **Purpose**: Debug the main DUPR service with TypeScript support
- **Usage**: Primary debugging configuration for development
- **Features**:
  - Automatic TypeScript compilation
  - Environment variable loading from `.env`
  - Source map support
  - Auto-restart on file changes

### 2. 🧪 **Debug DUPR Tests**
- **Purpose**: Debug Jest test suites
- **Usage**: Debug failing tests or test logic
- **Features**:
  - Run all tests with debugging
  - Break on test failures
  - Step through test code

### 3. 🔍 **Debug Current Test File**
- **Purpose**: Debug only the currently open test file
- **Usage**: Focus debugging on specific test file
- **Features**:
  - Context-aware (debugs the file you're viewing)
  - Faster execution than full test suite
  - Perfect for TDD workflow

### 4. 🏗️ **Debug Build Process**
- **Purpose**: Debug TypeScript compilation issues
- **Usage**: Troubleshoot build problems
- **Features**:
  - Step through TypeScript compilation
  - Identify compilation errors
  - Build configuration debugging

### 5. 🔧 **Attach to Running DUPR Service**
- **Purpose**: Attach to already running service in debug mode
- **Usage**: Debug production-like scenarios
- **Setup**:
  ```bash
  npm run dev:debug  # Starts service with debug port 9229
  ```

## 🛠️ Development Workflow

### **Basic Debugging Session**
1. Open `src/controllers/duprController.ts`
2. Set breakpoint in `validatePlayer` method
3. Press `F5` to start debugging
4. Make API request to trigger breakpoint
5. Use debug controls to step through code

### **API Endpoint Testing**
1. Start debug session (`F5`)
2. Open integrated terminal (`Ctrl+` `)
3. Run endpoint tests:
   ```bash
   npm run debug:endpoints
   ```
4. Breakpoints will trigger on API calls

### **Test-Driven Development**
1. Write test in `src/**/*.test.ts`
2. Set breakpoints in test and source code
3. Use "Debug Current Test File" configuration
4. Step through test execution and implementation

## 🔧 Debug Controls

| Shortcut | Action | Description |
|----------|---------|-------------|
| `F5` | Continue | Continue execution |
| `F10` | Step Over | Execute current line, don't enter functions |
| `F11` | Step Into | Enter function calls |
| `Shift+F11` | Step Out | Exit current function |
| `Ctrl+Shift+F5` | Restart | Restart debugging session |
| `Shift+F5` | Stop | Stop debugging session |

## 📊 Debug Features

### **Variables Panel**
- View local, global, and closure variables
- Expand objects and arrays
- Modify variable values during debugging
- Watch specific expressions

### **Call Stack**
- Navigate through function call hierarchy
- Jump to different stack frames
- Understand code execution flow

### **Breakpoints Panel**
- Manage all breakpoints
- Enable/disable breakpoints
- Set conditional breakpoints
- Add logpoints (console.log without stopping)

### **Debug Console**
- Execute code in current context
- Evaluate expressions
- Call functions with current scope
- REPL for debugging session

## 🎨 Advanced Debugging Techniques

### **Conditional Breakpoints**
Right-click on breakpoint → "Edit Breakpoint" → Add condition:
```javascript
duprId === '4581541063' && email.includes('@example.com')
```

### **Logpoints**
Right-click in gutter → "Add Logpoint":
```javascript
Player validation attempt: {duprId}, Email: {email}
```

### **Hit Count Breakpoints**
Useful for loops or frequently called functions:
```
Hit Count: >5    // Break after 5th hit
Hit Count: %3    // Break every 3rd hit
```

### **Exception Breakpoints**
- **Caught Exceptions**: Break on handled errors
- **Uncaught Exceptions**: Break on unhandled errors
- **User Uncaught Exceptions**: Break on user code errors only

## 🔍 Environment-Specific Debugging

### **Development Mode**
```bash
npm run dev:debug    # Nodemon with debug port
```
- Automatic restarts
- TypeScript compilation
- Environment variable loading

### **Production Mode**
```bash
npm run build
npm run start:debug  # Production build with debug
```
- Optimized code
- Production environment
- Performance debugging

### **Test Mode**
```bash
npm run test:debug   # Jest with debug port
```
- Test environment variables
- Mock implementations
- Assertion debugging

## 📁 Project-Specific Settings

### **File Exclusions**
The following are excluded from search/debugging:
- `node_modules/`
- `dist/`
- `logs/`
- `coverage/`
- `.nyc_output/`

### **TypeScript Configuration**
- Source maps enabled for accurate debugging
- Relative imports preferred
- Auto-import suggestions enabled
- Import organization on save

### **ESLint Integration**
- Real-time linting during debugging
- Auto-fix on save
- Problem panel integration
- Error highlighting

## 🧪 Testing Integration

### **Jest Debugging**
```bash
# Debug all tests
npm run test:debug

# Debug specific test file
npm run test:debug -- --testPathPattern=duprController

# Debug with watch mode
npm run test:watch
```

### **API Testing with Thunder Client**
1. Install Thunder Client extension
2. Import API collection from Swagger docs
3. Set breakpoints in controllers
4. Send requests through Thunder Client
5. Debug API flow in real-time

## 🚨 Common Issues & Solutions

### **Breakpoints Not Hitting**
- ✅ Check source maps are enabled
- ✅ Verify file paths in launch configuration
- ✅ Ensure TypeScript compilation is working
- ✅ Restart debugging session

### **Environment Variables Not Loading**
- ✅ Check `.env` file exists
- ✅ Verify `envFile` path in launch.json
- ✅ Restart debugging session
- ✅ Check file permissions

### **Port Already in Use**
```bash
# Kill process using debug port
lsof -ti:9229 | xargs kill -9

# Or use different port in launch.json
"port": 9230
```

### **TypeScript Errors in Debug Console**
- Use compiled JavaScript object names
- Check variable scope and context
- Verify source map accuracy

## 📊 Performance Debugging

### **Memory Usage**
```javascript
// In debug console
process.memoryUsage()
```

### **Performance Timing**
```javascript
// Add to code for timing
console.time('API Call');
// ... your code
console.timeEnd('API Call');
```

### **Async Debugging**
- Use async/await consistently
- Set breakpoints in Promise chains
- Debug callback functions
- Monitor Promise states

## 🔧 VS Code Extensions for Better Debugging

**Recommended Extensions** (auto-suggested):
- **ESLint**: Real-time linting
- **Prettier**: Code formatting
- **Thunder Client**: API testing
- **Error Lens**: Inline error display
- **Path Intellisense**: Import path completion
- **Code Spell Checker**: Typo detection

## 📚 Additional Resources

### **Keyboard Shortcuts**
- `Ctrl+Shift+D`: Open Debug panel
- `F9`: Toggle breakpoint
- `Ctrl+K F9`: Toggle breakpoint (alternative)
- `Ctrl+Shift+F9`: Toggle all breakpoints

### **Debug Output**
Monitor debug output in:
- **Debug Console**: Interactive debugging
- **Terminal**: Service output and logs
- **Problems Panel**: Linting and compilation errors
- **Output Panel**: Extension-specific logs

### **Logging Integration**
The service uses Winston logger with debug-friendly configuration:
```typescript
logger.debug('Debug message', { data });
logger.info('Info message', { data });
logger.error('Error message', error);
```

## 🎉 Pro Tips

1. **Use logpoints instead of console.log** for non-breaking debugging
2. **Set up workspace-specific settings** for consistent debugging experience  
3. **Use conditional breakpoints** to debug specific scenarios
4. **Leverage the debug console** for real-time code evaluation
5. **Combine with API documentation** at `http://localhost:3001/docs`
6. **Use source control integration** to debug specific commits
7. **Profile performance** using built-in Node.js profiler

Happy debugging! 🚀