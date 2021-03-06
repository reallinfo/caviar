const EventEmitter = require('events')
const {
  SyncHook,
  AsyncParallelHook
} = require('tapable')
const {
  Hooks,
  CLEAN
} = require('progress-hooks')

// const {readConfig} = require('./utils')

const createSandboxHooks = () => new Hooks({
  sandboxEnvironment: new SyncHook(['sandbox']),
})

const createNonSandboxHooks = () => new Hooks({
  // Intercept into the last phase of environment setting
  environment: new AsyncParallelHook(['context']),
  // Intercept into the last phase of webpack config generating
  webpackConfig: {
    hook: new SyncHook(['webpackConfig', 'options']),
    plan: 2
  },

  serverConfig: new SyncHook(['roeConfig']),
  nextConfig: new SyncHook(['nextConfig'])
})

class Lifecycle extends EventEmitter {
  constructor ({
    plugins,
    sandbox = false,
    configFile
  }) {
    super()
    this._plugins = plugins
    this._sandbox = sandbox
    this._configFile = configFile

    // Prevent plugins from accessing Lifecycle methods
    this._applyTarget = {
      hooks: sandbox
        ? createSandboxHooks()
        : createNonSandboxHooks()
    }
  }

  get hooks () {
    return this._applyTarget.hooks
  }

  // - sandbox `boolean` whether the current process is sandbox
  applyPlugins () {
    this._plugins.forEach(plugin => {
      // We only apply sandbox-specific plugins in sandbox
      if (this._sandbox === !plugin.sandbox) {
        return
      }

      plugin.apply(this._applyTarget)
    })
  }

  clearPlugins () {
    this.hooks[CLEAN]()
  }

  reloadConfig () {
    const file = this._configFile

    if (!file) {
      return
    }

    delete require.cache[file]
    const config = readConfig(file)
    const {
      plugins = []
    } = config

    this._plugins = plugins
    this.emit('config-reload', config)
  }
}

module.exports = {
  Lifecycle
}
